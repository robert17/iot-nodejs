var IoTAppClient;
try {
	IoTAppClient = require("ibmiotf").IotfApplication;
} catch (err) {
	IoTAppClient = require("../").IotfApplication; // when running locally in the samples directory
}

//read the config from the application.cfg
var config = IoTAppClient.parseConfigFile('./application.cfg');

var application = new IoTAppClient(config);

var deviceType = "iotsample-device";
var deviceId = "testDevice0001"

//function returns a promise. 
var promise = application.registerDevice(deviceType, deviceId);

application.connect();

promise
	.then(function(response) {
		//response has the registered device info
		console.log("Device registered with device ID : "+response.id);

		console.log("Publishing event with the registered Device");

		setInterval(function () {

			payload = '{ "d" : { "cpu" : 23 , "temp" : 33.2 , "humidity" : 67 } }';
			application.publishDeviceEvent(response.type, response.id, "status", "json",payload);

			console.log("Publishing events from %s with payload : %s", deviceId, payload);
		}, 2000);
})	
	.fail(function (error) {
		console.log("Register device failed with : "+error);
});


process.on( 'SIGINT', function() {
	console.log("Unregistering the Device");
	var promise = application.unregisterDevice(deviceType,deviceId);
	promise.then(function(){
		console.log( "Disconnecting the client" );
		application.disconnect();
		process.exit();
	}).fail(function(){
		console.log( "Disconnecting the client" );
		process.exit();
	});
});