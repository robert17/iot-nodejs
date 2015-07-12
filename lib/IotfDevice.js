/**
 *****************************************************************************
 Copyright (c) 2015 IBM Corporation and other Contributors.
 All rights reserved. This program and the accompanying materials
 are made available under the terms of the Eclipse Public License v1.0
 which accompanies this distribution, and is available at
 http://www.eclipse.org/legal/epl-v10.html
 Contributors:
 IBM - Initial Contribution
 *****************************************************************************
 * 
 */

module.exports = IotfDevice;

var mqtt = require("mqtt");
var inArray = require('in-array');
var log4js = require("log4js");
var util = require("util");

var SUPPORTED_CALLBACKS = ['command', 'connect'];

var CMD_RE = /^iot-2\/cmd\/(.+)\/fmt\/(.+)$/;

/**
* Constructor - returns a new instance of {IotfDevice}
* 
* @param options - options json containing the deviceid, device type, auth details in this format 
* org=$org
* type=$type
* id=$id
* auth-method=token
* auth-token=$authtoken
*/
function IotfDevice(config){
	// Allow constructor to be called safely without "new"
	if (!(this instanceof IotfDevice)) {
		return new IotfDevice(config);
	}

	this.logger = log4js.getLogger();
	//Change this if more debug info needed
	this.logger.setLevel('INFO');

	this.logger.trace("Initialization of IotfDevice entry..");
	this.host = null;
	this.options = {};
	this.callbacks = {};
	this.isQuickstart = false;

	//to check if the connection is present
	this.isConnected = false;

	//retryCount
	this.retryCount = 0;

	if (typeof config.org === 'undefined' || config.org === null) {
		this.logger.fatal("Missing required property : org");
		throw new Error("Missing required property : org");
	}

	if (typeof config.type === 'undefined' || config.type === null) {
		this.logger.fatal("Missing required property : type");
		throw new Error("Missing required property : type");
	}

	if (typeof config.id === 'undefined' || config.id === null) {
		this.logger.fatal("Missing required property : id");
		throw new Error("Missing required property : id");
	}

	var clientId = "d:" + config['org'] + ":" + config['type'] + ":" + config['id'];

	if(config['org'] === "quickstart"){

		this.host = "tcp://quickstart.messaging.internetofthings.ibmcloud.com:1883";
		this.isQuickstart = true;
		this.options = {
			clientId : clientId
		};

	} else {

		this.host = "ssl://"+config['org']+".messaging.internetofthings.ibmcloud.com:8883";

		if (typeof config['auth-method'] === 'undefined' || config['auth-method'] === null) {
			this.logger.fatal("Missing required property for registered mode: auth-method");
			throw new Error("Missing required property for registered mode: auth-method");
		}

		if(config['auth-method'] !== 'token'){
			this.logger.fatal("Unsupported Authentication Method: "+config['auth-method']);
			throw new Error("Unsupported Authentication Method: "+config['auth-method']);
		}

		if (typeof config['auth-token'] === 'undefined' || config['auth-token'] === null) {
			this.logger.fatal("Missing required property for token based authentication: auth-token");
			throw new Error("Missing required property for token based authentication: auth-token");
		}

		this.options = {
			clientId : clientId,
			username : "use-token-auth",
			password : config['auth-token'],
			rejectUnauthorized : true,
			caPaths : [__dirname + '/IoTFoundation.pem']
		};

		this.logger.trace("Initialization of IotfDevice exit..");
	}
}

/*
 * Functions used to connect to the IoT Foundation service
 */

IotfDevice.prototype.connect = function(){
	
	this.logger.debug("Connecting to IoTF with host : "+this.host);
	
	this.mqtt = mqtt.connect(this.host, this.options);

	var self = this;

	this.mqtt.on('connect', function () {
		
		self.logger.info("Connected to IoTF successfully");

		self.isConnected = true;
		//call the connect callback only for the fresh connection not reconnect
		if(self.callbacks.connect && self.retryCount === 0) {
			self.callbacks.connect();
		}

		//reset the counter to 0 incase of reconnection
		self.retryCount = 0;

		//subscribe to all commands if not in quickstart
		if(!self.isQuickstart){
			self.logger.debug("subscribing to all commands");
			var wildCardTopic = 'iot-2/cmd/+/fmt/+';
			self.mqtt.subscribe(wildCardTopic ,{qos:2});
		}
	});

	//retry connection only when the client is offline not while disconnecting
	this.mqtt.on('offline', function () {
		
		self.logger.info("Iotfclient is offline");
		self.isConnected = false;

		self.retryCount++;

		if(self.retryCount < 5) {
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

	this.mqtt.on('message', function (topic, payload) {
		
		self.logger.trace("Message received on ",topic,payload);

		if(self.callbacks.command){
			var match = CMD_RE.exec(topic);
			if(match){
				self.callbacks.command(match[1], match[2], payload, topic);
				return;
			}
		}
		
	});
	
};

/*
* Function to publish events to IoT Foundation.
* @param {String} eventType - Type of event e.g status, gps
* @param {String} eventFormat - format of the event e.g. json, xml
* @param {String} payload - Payload of the event
* @param {int} qos - qos for the publish. Accepted values are 0,1,2. Default is 0
* @returns {IotfDevice} this - for chaining
*/
IotfDevice.prototype.publish = function(eventType, eventFormat, payload, qos) {

	var topic = util.format("iot-2/evt/%s/fmt/%s",eventType, eventFormat);
	var QOS = qos || 0;

	if (!this.mqtt) {
		this.logger.fatal("Device Client is not yet Initialized. Call the constructor first IotfDevice(config)");
		throw new Error("Device Client is not yet Initialized. Call the constructor first IotfDevice(config)");
	}

	this.logger.trace("Publishing to topic : "+ topic + " with payload : "+payload);

	this.mqtt.publish(topic,payload,{qos: QOS});
	
	return this;
}

/*
* Function to disconnect from IoT Foundation.
*
*/
IotfDevice.prototype.disconnect = function() {

	if (!this.mqtt) {
		this.logger.fatal("Device Client is not yet Initialized. Call the constructor first IotfDevice(config)");
		throw new Error("Device Client is not yet Initialized. Call the constructor first IotfDevice(config)");
	}
	
	var self = this;
	this.isConnected = false;
	this.mqtt.end(false, function () {
		self.logger.info("Disconnected from the client.");
	});
	
	this.mqtt = null;
}
/**
* on - register <callback> for <type>
* 
* @param {String} type - one of 'command', 'connect'
* @param {Function} callback - the function to be registered
* @returns {IotfApplication} this - for chaining
*/
IotfDevice.prototype.on = function(type, callback){
	if(inArray(SUPPORTED_CALLBACKS, type)){
		this.callbacks[type] = callback;
	} else {
		this.logger.warn("The callback of type " + type + " is not suported");
	}
	return this;
};


var propReader = require('properties-reader');

/*
* Function to parse the configuration file and return a config object
*
*/
IotfDevice.parseConfigFile = function (configFilePath) {

	var properties = propReader(configFilePath);

	return {
		"org" : properties.get('org'),
		"type" : properties.get('type'),
		"id" : properties.get('id'),
		"auth-method" : properties.get('auth-method'),
		"auth-token" : properties.get('auth-token')
	};
}