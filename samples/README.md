# node.js Samples

##helloworld.js
Sample code demonstrating how to send events to the cloud from a device and process them in an application. This sample uses the [Quickstart](http://quickstart.internetofthings.ibmcloud.com/) service. 

Usage  : node helloworldDevice <12 digit hex>

```
me@localhost ~ $ node helloworld 112233445566
Received live data from 112233445566(iotsample-nodejs) with data { "d" : { "cpu" : 23 , "temp" : 33.2 , "humidity" : 67 } }
Received live data from 112233445566(iotsample-nodejs) with data { "d" : { "cpu" : 23 , "temp" : 33.2 , "humidity" : 67 } }
Received live data from 112233445566(iotsample-nodejs) with data { "d" : { "cpu" : 23 , "temp" : 33.2 , "humidity" : 67 } }
Received live data from 112233445566(iotsample-nodejs) with data { "d" : { "cpu" : 23 , "temp" : 33.2 , "humidity" : 67 } }
Received live data from 112233445566(iotsample-nodejs) with data { "d" : { "cpu" : 23 , "temp" : 33.2 , "humidity" : 67 } }
Received live data from 112233445566(iotsample-nodejs) with data { "d" : { "cpu" : 23 , "temp" : 33.2 , "humidity" : 67 } }
Received live data from 112233445566(iotsample-nodejs) with data { "d" : { "cpu" : 23 , "temp" : 33.2 , "humidity" : 67 } }
Disconnecting the client
```

##sampleDevice.js
Sample code demonstrating how to send events to the cloud using the Registered service in Internet of Things Foundation. In this mode, the device can both publish events and receive commands. 
But for running this sample, you must first register the device at https://internetofthings.ibmcloud.com/#/ and copy the credentials in the device.cfg file. Using this sample, users can publish events and receive commands from the Internet of Things Foundation service.

```
[root@localhost ~]# vi device.cfg
[root@localhost ~]# node sampleDevice
Publishing data : { "d" : { "cpu" : 23 , "temp" : 33.2 , "humidity" : 67 } }
Publishing data : { "d" : { "cpu" : 23 , "temp" : 33.2 , "humidity" : 67 } }
setInterval command received
{"interval" : 4}
Publishing data : { "d" : { "cpu" : 23 , "temp" : 33.2 , "humidity" : 67 } }
Publishing data : { "d" : { "cpu" : 23 , "temp" : 33.2 , "humidity" : 67 } }
Publishing data : { "d" : { "cpu" : 23 , "temp" : 33.2 , "humidity" : 67 } }
Publishing data : { "d" : { "cpu" : 23 , "temp" : 33.2 , "humidity" : 67 } }
Publishing data : { "d" : { "cpu" : 23 , "temp" : 33.2 , "humidity" : 67 } }
Publishing data : { "d" : { "cpu" : 23 , "temp" : 33.2 , "humidity" : 67 } }
Publishing data : { "d" : { "cpu" : 23 , "temp" : 33.2 , "humidity" : 67 } }
Command not supported.. blink
Publishing data : { "d" : { "cpu" : 23 , "temp" : 33.2 , "humidity" : 67 } }
Disconnecting the client
```
In this example,  the device is publishing every 2 second and can also receive commands. This sample is designed to accept only setInterval command, but not blink.

##sampleApplication.js
This sample code demonstrates the various functions of the application client. 
But for running this sample, you must first generate the api-key of your  organization from https://internetofthings.ibmcloud.com/dashboard/#/access/apikeys and copy the credentials in the application.cfg file. The format of application config file is as follows
```
org=$orgId
id=$uniqueApplicationId
auth-key=$api-key
auth-token=$token
```
This sample first registers a new device using ```registerDevice```. Then it publishes events for the registered device. Hit Ctrl+c to unregister the device and stop this sample.
Usage : node sampleApplication
```
[root@localhost ~]# vi application.cfg
[root@localhost ~]# node sampleApplication
Device registered with device ID : testDevice0001
Publishing event with the registered Device
Publishing events from testDevice0001 with payload : { "d" : { "cpu" : 23 , "temp" : 33.2 , "humidity" : 67 } }
Publishing events from testDevice0001 with payload : { "d" : { "cpu" : 23 , "temp" : 33.2 , "humidity" : 67 } }
Publishing events from testDevice0001 with payload : { "d" : { "cpu" : 23 , "temp" : 33.2 , "humidity" : 67 } }
Publishing events from testDevice0001 with payload : { "d" : { "cpu" : 23 , "temp" : 33.2 , "humidity" : 67 } }
Publishing events from testDevice0001 with payload : { "d" : { "cpu" : 23 , "temp" : 33.2 , "humidity" : 67 } }
Disconnecting the client
```
