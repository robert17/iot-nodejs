/******************************************************************************
 * dmRebootSample.js
 *
 * Connect as a managed device to IoTF and perform a device reboot.
 *
 * config:
 * {
 *   "apiKey": "...",
 *   "apiToken": "...",
 *   "org": "...",
 *   "id": "...",
 *   "type": "...",
 *   "auth-method": "token",
 *   "auth-token": "...",
 *   "port": 443
 * }
 *
 * 1. Connects to Watson IoT Platform
 * 2. Sets device as managed
 * 3. Sends HTTP request to initiate device reboot action for the device
 * 4. Receives device reboot command and simulates a reboot
 * 5. Reconnects to Watson IoT Platform
 * 6. Sets device as managed -- This completes the device reboot action
 * 7. Cleans up the completed device management request
 * 8. Disconnects
 *****************************************************************************/

function setDeviceManaged() {
  client.manage(7200, true, true);

  if (!complete) {
    setTimeout(sendRebootRequest, 1000);
  } else {
    getDeviceMgmtRebootRequests();
  }
}

function sendRebootRequest() {
  console.log('Initiate device reboot');

  var host = 'https://'+config.org+'.internetofthings.ibmcloud.com/api/v0002/mgmt/requests';
  var payload = {"action": "device/reboot", "devices": [{"typeId":config.type,"deviceId":config.id}]};

  request.post({url:host,json:payload,auth:{user:config.apiKey,pass:config.apiToken}}, function(error, response, body) {
    if (!error && response.statusCode == 202) {
      console.log("Initiate device reboot action completed successfully.");
      console.log(body);
    } else {
      console.log("Initiate device reboot action failed.");
      console.log(error);
      quit();
    }
  });
}

function doReboot() {
  console.log('Simulating device reboot.');
  client.disconnect();
  setTimeout(function() {
    complete = true;
    client.connect();
  }, 2000);
}

function getDeviceMgmtRebootRequests() {
  console.log('Get Device Management Reboot requests');
  var host = 'https://'+config.org+'.internetofthings.ibmcloud.com/api/v0002/mgmt/requests';
  var headers = {
      'auth': {
          'user': config.apiKey,
          'pass': config.apiToken
      }, 
      'Content-Type': 'application/json'
  };
  request.get(host, headers, function(error, response, body) {
    console.log(response.statusCode);
    if (!error && response.statusCode == 200) {
      var jsonPayload = JSON.parse(body);
      if (jsonPayload.meta.total_rows > 0) {
        for (var requestIndex in jsonPayload.results) {
          var requestObj = jsonPayload.results[requestIndex];
          var requestId = requestObj.id;
          if (requestObj.complete == true && requestObj.action == "device/reboot") {
            console.log('Found completed device management reboot request:');
            console.log(requestObj);
            deleteDeviceMgmtRequest(requestId);
          }
        }
      }
    }
  });
}

function deleteDeviceMgmtRequest(reqId) {
  console.log('Deleting device management reboot request id : ' + reqId);
  var host = 'https://'+config.org+'.internetofthings.ibmcloud.com/api/v0002/mgmt/requests/'+reqId;
  var headers = {
      'auth': {
          'user': config.apiKey,
          'pass': config.apiToken
      }, 
      'Content-Type': 'application/json'
  };

  request.del(host, headers, function(error, response, body) {
    if (!error && response.statusCode == 204) {
      console.log('Successfully deleted Deivce Management request');
      quit();
    }
  });
}

function quit() {
  client.disconnect();
  console.log("IoTF DM Reboot Sample completed. Exiting.");
}

var https = require('https');
var request = require('request');
var Client = require("ibmiotf").IotfManagedDevice;
var config = require('./config.json');
var complete = false;

var client = new Client(config);

console.log('Begin IoTF DM Reboot Sample');
client.connect();
client.log.setLevel("debug");

client.on('connect', function() {
  setTimeout(setDeviceManaged, 1000);
});

client.on('dmResponse', function(response) {
  console.log('Client received dmResponse: rc='+response.rc+' reqId='+response.reqId);
});

client.on('dmAction', function(request) {
  console.log('Client received dmAction: action='+request.action);
  if (request.action == "reboot") {
    client.respondDeviceRequest(request.reqId, client.ResponseCode.ACCEPT);
    setTimeout(doReboot, 2000);
  }
});

