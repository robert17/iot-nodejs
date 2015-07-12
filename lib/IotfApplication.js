/**
 *****************************************************************************
 Copyright (c) 2014, 2015 IBM Corporation and other Contributors.
 All rights reserved. This program and the accompanying materials
 are made available under the terms of the Eclipse Public License v1.0
 which accompanies this distribution, and is available at
 http://www.eclipse.org/legal/epl-v10.html
 Contributors:
 IBM - Initial Contribution
 *****************************************************************************
 * 
 */

module.exports = IotfApplication;

var mqtt = require("mqtt");
var inArray = require('in-array');
var request = require('request');
var Q = require('q');
var log4js = require("log4js");
var util = require("util");


var DEVICE_EVT_RE = /^iot-2\/type\/(.+)\/id\/(.+)\/evt\/(.+)\/fmt\/(.+)$/;
var DEVICE_CMD_RE = /^iot-2\/type\/(.+)\/id\/(.+)\/cmd\/(.+)\/fmt\/(.+)$/;
var DEVICE_MON_RE = /^iot-2\/type\/(.+)\/id\/(.+)\/mon$/;
var APP_MON_RE    = /^iot-2\/app\/(.+)\/mon$/;
var SUPPORTED_CALLBACKS = ['deviceEvent', 'deviceCommand', 'deviceStatus', 'appStatus', 'connect'];

/**
* Constructor - returns a new instance of {IotfApplication}
* 
* @param config - config json containing the api-key, auth token and application id
*/
function IotfApplication(config){
	// Allow constructor to be called safely without "new"
	if (!(this instanceof IotfApplication)) {
		return new IotfApplication(config);
	}
	
	this.logger = log4js.getLogger();
	//Change this if more debug info needed
	this.logger.setLevel('INFO');

	this.host = null;
	this.options = {};
	this.callbacks = {};
	
	//maintain the subs list so that on reconnection subscribe them back
	this.subscriptions = {};
	this.subscriptionCount = 0;

	//connection retry conunt
	this.retryCount = 0;
	//to check if the connection is present
	this.isConnected = false;

	if (typeof config.org === 'undefined' || config.org === null) {
		this.logger.fatal("Missing required property : org");
		throw new Error("Missing required property : org");
	} else {
		this.org = config.org;
	}

	if (typeof config.id === 'undefined' || config.id === null) {
		this.logger.fatal("Missing required property : id");
		throw new Error("Missing required property : id");
	} else {
		this.id = config.id;
	}

	var clientId = "a:" + this.org + ":" + this.id;
	
	//for quickstart mode
	if(this.org === 'quickstart') {

		this.host = "tcp://quickstart.messaging.internetofthings.ibmcloud.com:1883";
		this.isQuickstart = true;
		this.options = {
			clientId : clientId
		};

	} else {
		// registered mode
		this.host = "ssl://"+this.org+".messaging.internetofthings.ibmcloud.com:8883";

		if (typeof config['auth-key'] === 'undefined' || config['auth-key'] === null) {
			this.logger.fatal("For registered mode, Missing required property : auth-key");
			throw new Error("For registered mode, Missing required property : auth-key");
		} else {
			this.apiKey = config['auth-key'];
		}


		if (typeof config['auth-token'] === 'undefined' || config['auth-token'] === null) {
			this.logger.fatal("For registered mode, Missing required property : auth-token");
			throw new Error("For registered mode, Missing required property : auth-token");
		} else {
			this.apiToken = config['auth-token'];
		}

		this.options = {
			clientId : clientId,
			username : config['auth-key'],
			password : config['auth-token'],
			rejectUnauthorized : true,
			caPaths : [__dirname + '/IoTFoundation.pem']
		};
	}
	
	this.logger.trace("IotfApplication initialized for organization : "+this.org);
}


/**
* Function to connect to IoTF service
* 
* @param {Function} callback - Callback function called when the connection succeeds or fails. function(err) { .. }
*/
IotfApplication.prototype.connect = function(){

	this.logger.debug("Connecting to IoTF with host : "+this.host);
	
	this.mqtt = mqtt.connect(this.host, this.options);

	var self = this; // for referencing "this" from inside nested function definition

	this.mqtt.on('connect',function(packet){

		self.logger.info("Connected to IoTF successfully");
		self.isConnected = true;

		self.logger.trace("Subscription Count = " + self.subscriptionCount);
		try	{
			for(var count = 0 ; count < self.subscriptionCount ; count++) {
				self.logger.trace((count + 1) + "\t" + self.subscriptions[count] );
				
				self.logger.trace("Resubscribing: ");
				self.mqtt.subscribe(self.subscriptions[count], {qos: 0});
			}
		
		}
		catch (err){
			self.logger.error("Error while trying to subscribe : "+err);
		}

		//reset the counter to 0 incase of reconnection
		self.retryCount = 0;

		//call the connect callback only for the fresh connection not reconnect
		if(self.callbacks.connect && self.retryCount === 0) {
			self.callbacks.connect();
		}

	});

	//retry connection only when the client is offline not while disconnecting
	this.mqtt.on('offline', function () {
		
		self.logger.info("Iotfclient is offline. Retrying connection");
		self.isConnected = false;

		self.retryCount++;

		if(self.retryCount < 3) {
			self.logger.trace("Retry in 3 sec. Count : "+self.retryCount);
			self.mqtt.options.reconnectPeriod = 3000;
		} else if(self.retryCount < 10) {
			self.logger.trace("Retry in 10 sec. Count : "+self.retryCount);
			self.mqtt.options.reconnectPeriod = 10000;
		} else {
			self.logger.trace("Retry in 60 sec. Count : "+self.retryCount);
			self.mqtt.options.reconnectPeriod = 60000;
		}

	});

	this.mqtt.on('close', function () {
		
		self.logger.info("Connection was closed.");
		self.isConnected = false;

	});

	this.mqtt.on('error', function (err) {
		
		self.isConnected = false;
		self.logger.error("Connection Error :: "+err);
		throw new Error(err);
		
	});
	
	
	this.mqtt.on('message', function(topic, payload){
		self.logger.trace("mqtt: ", topic, payload.toString());
		
		// For each type of registered callback, check the incoming topic against a Regexp.
		// If matches, forward the payload and various fields from the topic (extracted using groups in the regexp)
		
		if(self.callbacks.deviceEvent){
			var match = DEVICE_EVT_RE.exec(topic);
			if(match){
				self.callbacks.deviceEvent(match[1], match[2], match[3], match[4], payload, topic);
				return;
			}
		}
		if(self.callbacks.deviceCommand){
			var match = DEVICE_CMD_RE.exec(topic);
			if(match){
				self.callbacks.deviceCommand(match[1], match[2], match[3], match[4], payload, topic);
				return;
			}
		}
		if(self.callbacks.deviceStatus){
			var match = DEVICE_MON_RE.exec(topic);
			if(match){
				self.callbacks.deviceStatus(match[1], match[2], payload, topic);
				return;
			}
		}
		if(self.callbacks.appStatus){
			var match = APP_MON_RE.exec(topic);
			if(match){
				self.callbacks.appStatus(match[1], payload, topic);
				return;
			}
		}
		
		// catch all which logs the receipt of an unexpected message
		self.logger.warn("Message received on unexpected topic"+", "+topic+", "+payload);
	});
};



IotfApplication.prototype.disconnect = function(){
	
	var self = this;
	this.isConnected = false;
	this.mqtt.end(false, function () {
		self.logger.info("Disconnected from the client.");
	});

	this.mqtt = null;
};


/**
* on - register <callback> for <type>
* 
* @param {String} type - one of 'deviceEvent', 'deviceCommand', 'deviceStatus', 'appStatus'
* @param {Function} callback - the callback to be registered for the message type
* @returns {IotfApplication} this - for chaining
*/
IotfApplication.prototype.on = function(type, callback){
	if(inArray(SUPPORTED_CALLBACKS, type)){
		this.callbacks[type] = callback;
	} else {
		this.logger.warn("The callback of type " + type + " is not suported");
	}
	return this;
};


/**
 * subscribe - subscribe to <topic>
 *
 * @param {String} topic - topic to subscribe to
 */
IotfApplication.prototype.subscribe = function(topic){

	if (!this.mqtt) {
		this.logger.fatal("Application Client is not yet Initialized. Call the constructor first IotfApplication(config)");
		throw new Error("Application Client is not yet Initialized. Call the constructor first IotfApplication(config)");
	}
	this.logger.trace("Subscribe: "+", "+topic);
	this.subscriptions[this.subscriptionCount] = topic;
	this.subscriptionCount++;

	if(this.isConnected) {
		this.mqtt.subscribe(topic, {qos: 0});
		this.logger.trace("Freshly Subscribed to: " +	this.subscriptions[this.subscriptionCount - 1]);
	} else {
		this.logger.warn("Unable to subscribe as application is not currently connected");
	}
	return;
};

/**
 * publish - publish <msg> to <topic>
 *
 * @param {String} topic - topic to publish to
 * @param {String} msg - message to publish
 */
IotfApplication.prototype.publish = function(topic, msg){

	if (!this.mqtt) {
		this.logger.fatal("Application Client is not yet Initialized. Call the constructor first IotfApplication(config)");
		throw new Error("Application Client is not yet Initialized. Call the constructor first IotfApplication(config)");
	}

	this.logger.trace("Publish: "+topic+", "+msg);
	
	if(this.isConnected) {
		this.mqtt.publish(topic, msg);
	} else {
		this.logger.warn("Unable to publish as application is not currently connected");
	}
	return;
};


/**
 * subscribeToDeviceEvents - builds and subscribes to iot-2/type/<type>/id/<id>/evt/<event>/fmt/<format>. If 
 *                           no value is specfied, it subscribes to all events('+')
 * @param {String} type
 * @param {String} id
 * @param {String} event
 * @param {String} format
 * @returns {IotfApplication} this - for chaining
 */
IotfApplication.prototype.subscribeToDeviceEvents = function(type, id, event, format){
	type = type || '+';
	id = id || '+';
	event = event || '+';
	format = format || '+';

	var topic = "iot-2/type/" + type + "/id/" + id + "/evt/"+ event + "/fmt/" + format;
	this.subscribe(topic);
	return this;
};


/**
 * subscribeToDeviceCommands - builds and subscribes to iot-2/type/<type>/id/<id>/cmd/<command>/fmt/<format>. If 
 *                           no value is specfied, it subscribes to all events('+')
 *
 * @param {String} type
 * @param {String} id
 * @param {String} command
 * @param {String} format
 * @returns {IotfApplication} this - for chaining
 */
IotfApplication.prototype.subscribeToDeviceCommands = function(type, id, command, format){
	type = type || '+';
	id = id || '+';
	command = command || '+';
	format = format || '+';

	var topic = "iot-2/type/" + type + "/id/" + id + "/cmd/"+ command + "/fmt/" + format;
	this.subscribe(topic);
	return this;
};


/**
 * subscribeToDeviceStatus - builds and subscribes to iot-2/type/<type>/id/<id>/mon. If 
 *                           no value is specfied, it subscribes to all events('+')
 *
 * @param {String} type
 * @param {String} id
 * @returns {IotfApplication} this - for chaining
 */
IotfApplication.prototype.subscribeToDeviceStatus = function(type, id){
	type = type || '+';
	id = id || '+';

	var topic = "iot-2/type/" + type + "/id/" + id + "/mon";
	this.subscribe(topic);
	return this;
};


/**
 * subscribeToAppStatus - builds and subscribes to iot-2/app/id/<id>/mon. If 
 *                           no value is specfied, it subscribes to all events('+')
 *
 * @param {String} id
 * @returns {IotfApplication} this - for chaining
 */
IotfApplication.prototype.subscribeToAppStatus = function(id){
	id = id || '+';

	var topic = "iot-2/app/" + id + "/mon";
	this.subscribe(topic);
	return this;
};


/**
 * publishDeviceEvent - builds and publishes to iot-2/type/<type>/id/<id>/evt/<event>/fmt/<format>
 *
 * @param {String} type
 * @param {String} id
 * @param {String} event
 * @param {String} format
 * @param {Object} data
 * @returns {IotfApplication} this - for chaining
 */
IotfApplication.prototype.publishDeviceEvent = function(type, id, event, format, data){
	var topic = "iot-2/type/" + type + "/id/" + id + "/evt/" + event + "/fmt/" + format;
	this.publish(topic, data);
	return this;
};

/**
 * publishDeviceCommand - builds and publishes to iot-2/type/<type>/id/<id>/cmd/<command>/fmt/<format>
 *
 * @param {String} type
 * @param {String} id
 * @param {String} command
 * @param {String} format
 * @param {Object} data
 * @returns {IotfApplication} this - for chaining
 */
IotfApplication.prototype.publishDeviceCommand = function(type, id, command, format, data){
	var topic = "iot-2/type/" + type + "/id/" + id + "/cmd/" + command + "/fmt/" + format;
	this.publish(topic, data);
	return this;
};


/*
 ************************************************************************
 * API Support
 ************************************************************************
 */

/**
* callApi -convenience method for making calls to the IoT ReST API
* 
* @param {String} method - HTTP Method for request
* @param {Integer} expectedHttpCode - expected HTTP code in response from server. If not as expected, promise will reject.
* @param {Boolean} expectJsonContent - if set, will attempt to parse server response into JSON
* @param {Array} paths - array of strings, each element will expand to a single path-level in URI to call. Can be null.
* 	Example:  E.g. ['devices', 'type1'] will result in a call to: (<apiHost>/api/v0001/organizations)/devices/type1
* @param {String} body - body of HTTP request to send, can be null
* @returns {Promise} promise. 
* 		If all goes well, promise resolves with a JSON object if expectJsonContent set, or a string otherwise. 
* 		If there is an error, promise will be rejected with an Error object containing a descriptive message.
*/
IotfApplication.prototype.callApi = function(method, expectedHttpCode, expectJsonContent, paths, body){
	var deferred = Q.defer();

	this.apiHost = "https://%s.internetofthings.ibmcloud.com/api/v0001";
	this.rejectUnauthorized = true;
	
	var uri = util.format(this.apiHost,this.org);
	
	if(paths){
		for(i in paths){
			uri += '/'+paths[i];
		}
	}	
	this.logger.trace("callApi: "+method+", "+uri);
	request(
			uri,
			{
				method: method,
				rejectUnauthorized: this.rejectUnauthorized,
				body: body,
				auth: {
					user: this.apiKey,
					pass: this.apiToken,
					sendImmediately: true
				},
				headers: {'Content-Type': 'application/json'}
			},		
			function (error, response, body) {
				if(error){
					deferred.reject(error);
				}else{
					if(response.statusCode == expectedHttpCode){
						if(expectJsonContent){
							try{
								deferred.resolve(JSON.parse(body));
							} catch (ex){
								deferred.reject(ex);
							}
						}else{
							deferred.resolve(body);
						}
					}else{
						deferred.reject(new Error(method+" "+uri+": Expected HTTP "+expectedHttpCode+" from server but got HTTP "+response.statusCode+". Error Body: "+body));
					}
				}
			}
	);
	return deferred.promise;
};

// TODO: interpret HTTP response codes and produce context-sensitive meaningful errors

IotfApplication.prototype.getOrganizationDetails = function(){
	this.logger.trace("getOrganizationDetails()");
	return this.callApi('GET', 200, true, null, null);
};

IotfApplication.prototype.listAllDevices = function(){
	this.logger.trace("listAllDevices()");
	return this.callApi('GET', 200, true, ['devices'], null);
};

IotfApplication.prototype.listAllDevicesOfType = function(type){
	this.logger.trace("listAllDevicesOfType("+type+")");
	return this.callApi('GET', 200, true, ['devices', type], null);
};

IotfApplication.prototype.listAllDeviceTypes = function(){
	this.logger.trace("listAllDeviceTypes()");
	return this.callApi('GET', 200, true, ['device-types'], null);
};

IotfApplication.prototype.registerDevice = function(type, id, metadata){
	this.logger.trace("registerDevice("+type+", "+id+", "+metadata+")");
	// TODO: field validation
	var body = {
			type: type,
			id: id,
			metadata: metadata
	};
	return this.callApi('POST', 201, true, ['devices'], JSON.stringify(body));
};

IotfApplication.prototype.unregisterDevice = function(type, id){
	this.logger.trace("unregisterDevice("+type+", "+id+")");
	return this.callApi('DELETE', 204, false, ['devices', type, id], null);
};

IotfApplication.prototype.updateDevice = function(type, id, metadata){
	this.logger.trace("updateDevice("+type+", "+id+", "+metadata+")");
	var body = {
			metadata: metadata
	};
	return this.callApi('PUT', 200, true, ['devices', type, id], JSON.stringify(body));
};

IotfApplication.prototype.getDeviceDetails = function(type, id){
	this.logger.trace("getDeviceDetails("+type+", "+id+")");
	return this.callApi('GET', 200, true, ['devices', type, id], null);
};


var propReader = require('properties-reader');
/*
* Function to parse the configuration file and return a config object
*
*/
IotfApplication.parseConfigFile = function (configFilePath) {

	var properties = propReader(configFilePath);

	return {
		"org" : properties.get('org'),
		"id" : properties.get('id'),
		"auth-key" : properties.get('auth-key'),
		"auth-token" : properties.get('auth-token')
	};
}