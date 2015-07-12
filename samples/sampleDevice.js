var client;
try {
	client = require("ibmiotf").IotfDevice;
} catch (err) {
	client = require("../").IotfDevice; // when running locally in the samples directory
}

//get the configuration from the device.cfg file
var config = client.parseConfigFile('./device.cfg');

var deviceClient = new client(config);

deviceClient.connect();

deviceClient.on("connect", function () {

	
	setInterval(function function_name (argument) {
		payload = '{ "d" : { "cpu" : 23 , "temp" : 33.2 , "humidity" : 67 } }';

		if(deviceClient.isConnected) {
			console.log("Publishing data : "+payload);
			deviceClient.publish("status","json",payload); 
		}
	}, 2000);

});

//listen to commands
deviceClient.on("command", function (commandName, format, payload, topic) {

	if(commandName === "setInterval") {
		console.log("setInterval command received");
		console.log(payload.toString());
	} else {
		console.log("Command not supported.. " + commandName);
	}

});

process.on( 'SIGINT', function() {
	console.log( "Disconnecting the client" );
	deviceClient.disconnect();
	process.exit( );
})