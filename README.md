Node.js Client Library
========================

The node.js client is used for simplifying the interacting with the Internet of Things Foundation. The following libraries contain instructions and guidance on using the nodejs ibmiotf node to interact with devices and applications within your organizations.

This client library is divided into two parts, Device and Application. The Devices section contains information on how devices publish events and handle commands using the nodejs ibmiotf module, and the Applications section contains information on how applications can use the nodejs ibmiotf module to interact with devices.

Devices
===============================

*IotfDevice* is device client for the Internet of Things Foundation
service. You can use this client to connect to the service, publish
events from the device and subscribe to commands.

Constructor
-----------

The constructor builds the device client instance. It accepts an
configuration json containing the following :

-   org - Your organization ID
-   type - The type of your device
-   id - The ID of your device
-   auth-method - Method of authentication (the only value currently
    supported is “token”)
-   auth-token - API key token (required if auth-method is “token”)

If you want to use quickstart, then send only the first three
properties.

``` {.sourceCode .javascript}
var Client = require("ibmiotf").IotfDevice;
var config = {
    "org" : "organization",
    "id" : "deviceId",
    "type" : "deviceType",
    "auth-method" : "token",
    "auth-token" : "authToken"
};

var deviceClient = new Client(config);

....
```

#### Using a configuration file

Instead of passing the configuration json directly, you can also use a
configuration file. Use the following code snippet

``` {.sourceCode .javascript}
var Client = require("ibmiotf").IotfDevice;

var config = Client.parseConfigFile(configFilePath);    
var deviceClient = new Client(config);

....
```

The configuration file must be in the format of

``` {.sourceCode .}
org=$orgId
type=$myDeviceType
id=$myDeviceId
auth-method=token
auth-token=$token
```

Connect
-------

Connect to the Internet of Things Foundation by calling the *connect*
function

``` {.sourceCode .javascript}
var Client = require("ibmiotf").IotfDevice;

var config = Client.parseConfigFile(configFilePath);    
var deviceClient = new Client(config);

deviceClient.connect();

deviceClient.on("connect", function () {

//Add your code here
});

....
```

After the successful connection to the IoTF service, the device client
emits *connect* event. So all the device logic can be implemented inside
this callback function.

Publishing events
------------------

Events are the mechanism by which devices publish data to the Internet
of Things Foundation. The device controls the content of the event and
assigns a name for each event it sends.

When an event is received by the IOT Foundation the credentials of the
connection on which the event was received are used to determine from
which device the event was sent. With this architecture it is impossible
for a device to impersonate another device.

Events can be published at any of the three quality of service levels
defined by the MQTT protocol. By default events will be published as qos
level 0.

Events can be published by using

-   eventType - Type of event to be published e.g status, gps
-   eventFormat - Format of the event e.g json
-   data - Payload of the event
-   QoS - qos for the publish event. Supported values : 0,1,2

``` {.sourceCode .javascript}
var config = IotfDevice.ParseConfigFile(configFilePath);    
var client = new IotfDevice(config);

client.connect();

client.on("connect", function () {
    //publishing event using the default quality of service
    client.publish("status","json",'{"d" : { "cpu" : 60, "mem" : 50 }}');

    //publishing event using the user-defined quality of service
    var myQosLevel=2
    client.publish("status","json",'{"d" : { "cpu" : 60, "mem" : 50 }}', myQosLevel); 
});

....
```

Handling commands
------------------

When the device client connects, it automatically subscribes to any
command for this device. To process specific commands you need to
register a command callback function. The device client emits *command*
when a command is received. The callback function has the following
properties

-   commandName - name of the command invoked
-   format - e.g json, xml
-   payload - payload for the command
-   topic - actual topic where the command was received

``` {.sourceCode .javascript}
var config = IotfDevice.ParseConfigFile(configFilePath);    
var client = new IotfDevice(config);

client.connect();

client.on("connect", function () {
    //publishing event using the default quality of service
    client.publish("status","json",'{"d" : { "cpu" : 60, "mem" : 50 }}');

});

client.on("command", function (commandName,format,payload,topic) {
    if(commandName === "blink") {
        console.log(blink);
        //function to be performed for this command
        blink(payload);
    } else {
        console.log("Command not supported.. " + commandName);
    }
});
.... 
```

Disconnect Client
--------------------

Disconnects the client and releases the connections

``` {.sourceCode .javascript}
var config = IotfDevice.ParseConfigFile(configFilePath);    
var client = new IotfDevice(config);

client.connect();

client.on("connect", function () {
    //publishing event using the default quality of service
    client.publish("status","json",'{"d" : { "cpu" : 60, "mem" : 50 }}');

    //publishing event using the user-defined quality of service
    var myQosLevel=2
    client.publish("status","json",'{"d" : { "cpu" : 60, "mem" : 50 }}', myQosLevel); 

    //disconnect the client
    client.disconnect();
});

....
```

Check Connection Status
--------------------------

*isConnected* gives the current status of the client connection

``` {.sourceCode .javascript}
//publishing event using the default quality of service
if(client.isConnected) {
    client.publish("status","json",'{"d" : { "cpu" : 60, "mem" : 50 }}');
}


....
```

nodejs Client Library - Application
===================================

*IotfApplication* is application client for the Internet of Things
Foundation service. This section contains information on how
applications interact with devices.

Constructor
-----------

The constructor builds the application client instance. It accepts an
configuration json containing the following :

-   org - Your organization ID
-   id - The unique ID of your application within your organization.
-   auth-key - API key
-   auth-token - API key token

If you want to use quickstart, then send only the first two properties.

``` {.sourceCode .javascript}
var Client = require("ibmiotf").IotfApplication;
var config = {
    "org" : orgId,
    "id" : appId,
    "auth-key" : apiKey,
    "auth-token" : apiToken
}

var appClient = new Client(config);

....
```

### Using a configuration file

Instead of passing the configuration json directly, you can also use a
configuration file. Use the following code snippet

``` {.sourceCode .javascript}
var Client = require("ibmiotf").IotfApplication;

var config = Client.parseConfigFile(configFilePath);    
var appClient = new Client(config);

....
```

The configuration file must be in the format of

``` {.sourceCode .}
org=$orgId
id=$myUniqueIs
auth-key=$apiKey
auth-token=$token
```

Connect
-------

Connect to the Internet of Things Foundation by calling the *connect*
function

``` {.sourceCode .javascript}
var Client = require("ibmiotf").IotfApplication;

var config = Client.parseConfigFile(configFilePath);    
var appClient = new Client(config);

appClient.connect();

appClient.on("connect", function () {

//Add your code here
});

....
```

After the successful connection to the IoTF service, the application
client emits *connect* event. So all the logic can be implemented inside
this callback function.