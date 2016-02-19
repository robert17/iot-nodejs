/******************************************************************************
 * dmFirmwareSample.js
 *
 * Connect as a managed device to Watson IoT Platform and performs a
 * firmware download action followed by a firmware update action.
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
 * 3. Sends HTTP request to initiate firmware download action for the device
 * 4. Receives update request with firmware URL, version, etc
 * 5. Publishes response back with rc=204
 * 6. Receives Observation request for field mgmt.firmware
 * 7. Publishes response back with rc=200
 * 8. Receives initiate firmware download request
 * 9. Publishes mgmt.firmware notify with state=1 (download in progress)
 * 10. Publishes mgmt.firmware notify with state=2 (download successful)
 * 11. Receives cancel request completing the firmware download action
 * 12. Sends HTTP request to initiate firmware update action for the device
 * 13. Receives Observation request for field mgmt.firmware
 * 14. Publishes response back with rc=200
 * 15. Receives initiate firmware update request
 * 16. Publishes mmgmt.firmware notify with updateStatus=1 (update in progress)
 * 17. Publishes mmgmt.firmware notify with updateStatus=0 (update complete)
 * 18. Receives cancel request completing the firmware update action
 * 19. Cleans up completed device management requests
 * 20. Disconnects
 *****************************************************************************/

function setDeviceManaged() {
  client.manage(7200, true, true);

  if (!complete) {
    setTimeout(sendDownloadRequest, 1000);
  } else {
    getDeviceMgmtFirmwareRequests("firmware/download");
  }
}

function sendDownloadRequest() {
  console.log('Initiate firmware download');

  var host = 'https://'+config.org+'.internetofthings.ibmcloud.com/api/v0002/mgmt/requests';
  var payload = {"action": "firmware/download", "parameters": [{"name":"uri","value":"http://9.3.177.124/kernel.svg"},{"name":"name","value":"firmwareName"},{"name":"version","value":"0.0.2"}], "devices": [{"typeId":config.type,"deviceId":config.id}]};

  request.post({url:host,json:payload,auth:{user:config.apiKey,pass:config.apiToken}}, function(error, response, body) {
    if (!error && response.statusCode == 202) {
      console.log("Initiate firmware download action completed successfully.");
    } else {
      console.log("Initiate firmware download action failed.");
      console.log(error);
      quit();
    }
  });
}

function sendUpdateRequest() {
  console.log('Initiate firmware update');

  var host = 'https://'+config.org+'.internetofthings.ibmcloud.com/api/v0002/mgmt/requests';
  var payload = {"action": "firmware/update", "devices": [{"typeId":"Performance","deviceId":"perftestdeviceB"}]};

  request.post({url:host,json:payload,auth:{user:config.apiKey,pass:config.apiToken}}, function(error, response, body) {
    if (!error && response.statusCode == 202) {
      console.log("Initiate firmware update action completed successfully.");
    } else {
      console.log("Initiate firmware update action failed.");
      console.log(error);
      quit();
    }
  });
}

function beginFirmwareDownload() {
  console.log("Simulating firmware download");
  var value = {};
  value.state = 1;
  client.publishDeviceNotify("mgmt.firmware", value);
  setTimeout(completeFirmwareDownload, 2000);
}

function completeFirmwareDownload() {
  console.log("Completing firmware download");
  var value = {};
  value.state = 2;
  client.publishDeviceNotify("mgmt.firmware", value);
  setTimeout(sendUpdateRequest, 2000);
}

function beginFirmwareUpdate() {
  console.log("Simulating firmware update");
  var value = {};
  value.state = 0;
  value.updateStatus = 1;
  client.publishDeviceNotify("mgmt.firmware", value);
  setTimeout(completeFirmwareUpdate, 2000);
}

function completeFirmwareUpdate() {
  console.log("Completing firmware update");
  var value = {};
  value.state = 0;
  value.updateStatus = 0;
  client.publishDeviceNotify("mgmt.firmware", value);
}

function getDeviceMgmtFirmwareRequests(type, quitAfterDelete) {
  console.log('Get Device Management '+type+' requests');
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
          if (requestObj.complete == true && requestObj.action == type) {
            console.log('Found completed device management '+type+' request:');
            console.log(requestObj);
            deleteDeviceMgmtRequest(requestId, quitAfterDelete);
          }
        }
      }
    }
  });
}

function deleteDeviceMgmtRequest(reqId, quitAfterDelete) {
  console.log('Deleting device management firmware request id : ' + reqId);
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
      if (quitAfterDelete) {
        quit();
      }
    }
  });
}

function quit() {
  client.disconnect();
  console.log("IoTF DM Firmware Sample completed. Exiting.");
}

var https = require('https');
var request = require('request');
var Client = require("ibmiotf").IotfManagedDevice;
var config = require('./config.json');
var complete = false;
var cancelCount = 0;

var client = new Client(config);

console.log('Begin IoTF DM Firmware Sample');
client.connect();
client.log.setLevel("debug");

client.on('connect', function() {
  console.log('Device Client Connected');
  setTimeout(setDeviceManaged, 1000);
});

client.on('dmResponse', function(response) {
  console.log('Client received dmResponse: rc='+response.rc+' reqId='+response.reqId);
});

client.on('dmAction', function(request) {
  console.log('Client received dmAction: action='+request.action);
  if (request.action == "firmware_download") {
    client.respondDeviceRequest(request.reqId, client.ResponseCode.ACCEPT);
    setTimeout(beginFirmwareDownload, 5000);
  } else if (request.action == "firmware_update") {
    client.respondDeviceRequest(request.reqId, client.ResponseCode.ACCEPT);
    setTimeout(beginFirmwareUpdate, 5000);
  }
});

client.on('dmUpdate', function(request) {
  console.log('Client received dmUpdate');
  client.respondDeviceRequest(request.reqId, client.ResponseCode.CHANGED);
});

client.on('dmObserve', function(request) {
  console.log('Client received dmObserve');
  client.respondDeviceRequest(request.reqId, client.ResponseCode.SUCCESS);
});

client.on('dmCancel', function(request) {
  console.log('Client received dmCancel');
  cancelCount++;
  client.respondDeviceRequest(request.reqId, client.ResponseCode.SUCCESS);
  if (cancelCount == 1) {
    getDeviceMgmtFirmwareRequests("firmware/download", false);
  } else {
    getDeviceMgmtFirmwareRequests("firmware/update", true);
  }
});
