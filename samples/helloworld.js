var device, application;
try {
	device = require("ibmiotf").IotfDevice;
	application = require("ibmiotf").IotfApplication;
} catch (err) {
	device = require("../").IotfDevice; // when running locally in the samples directory
	application = require("../").IotfApplication;
}

//get the first arg. In nodejs, the first two have node and program name, so need to read the 3rd value. 
var deviceId = process.argv[2];

if(!deviceId) {
	console.log("Usage  : node helloworldDevice <12 digit hex>");
	console.log("Example: node helloworldDevice b827eba84426");
	return;
}

var deviceConfig = {
	"org" : "quickstart",
	"type" : "iotsample-nodejs",
	"id" : deviceId
};

var appConfig = {
	"org" : "quickstart",
	"id" : deviceId+"_receiver"
};

//initialize the device Client to send the event messages.
var deviceClient = new device(deviceConfig);
//initialize the application client to recieve the messages sent by the device client
var appClient = new application(appConfig);

appClient.connect();

appClient.on('connect', function() {
	//subscribe to all events from this device type and id.
	appClient.subscribeToDeviceEvents(deviceConfig.type,deviceConfig.id)
})

//this callback will be called when an event is received for the subscription.
appClient.on('deviceEvent', function(type, id, eventType, eventFormat, payload, topic) {
	//subscribe to all events from this device type and id.
	console.log("Received live data from %s(%s) with data %s", id,type,payload.toString());
})

deviceClient.connect();

deviceClient.on("connect", function () {

	
	setInterval(function function_name (argument) {
		payload = '{ "d" : { "cpu" : 23 , "temp" : 33.2 , "humidity" : 67 } }';

		if(deviceClient.isConnected) {
			deviceClient.publish("status","json",payload); 
		}
	}, 2000);

});

process.on( 'SIGINT', function() {
	console.log( "Disconnecting the client" );
	deviceClient.disconnect();
	appClient.disconnect();
	process.exit();
});