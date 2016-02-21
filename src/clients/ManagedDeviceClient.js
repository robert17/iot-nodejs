/**
 *****************************************************************************
 Copyright (c) 2014, 2015 IBM Corporation and other Contributors.
 All rights reserved. This program and the accompanying materials
 are made available under the terms of the Eclipse Public License v1.0
 which accompanies this distribution, and is available at
 http://www.eclipse.org/legal/epl-v10.html
 Contributors:
 Harrison Kurtz - Initial Contribution
 Jeffrey Dare
 *****************************************************************************
 *
 */
import format from 'format';

import { isDefined, isString, isNumber, isBoolean, isNode, generateUUID } from '../util/util.js';
import { default as DeviceClient } from './DeviceClient.js';

const QUICKSTART_ORG_ID = 'quickstart';
const QOS = 1;

// Publish MQTT topics
const RESPONSE_TOPIC = 'iotdevice-1/response';
const MANAGE_TOPIC = 'iotdevice-1/mgmt/manage';
const UNMANAGE_TOPIC = 'iotdevice-1/mgmt/unmanage';
const UPDATE_LOCATION_TOPIC = 'iotdevice-1/device/update/location';
const ADD_LOG_TOPIC = 'iotdevice-1/add/diag/log';
const CLEAR_LOGS_TOPIC = 'iotdevice-1/clear/diag/log';
const ADD_ERROR_CODE_TOPIC = 'iotdevice-1/add/diag/errorCodes';
const CLEAR_ERROR_CODES_TOPIC = 'iotdevice-1/clear/diag/errorCodes';
const NOTIFY_TOPIC = 'iotdevice-1/notify';

// Subscribe MQTT topics
const DM_WILDCARD_TOPIC = 'iotdm-1/#';
const DM_RESPONSE_TOPIC = 'iotdm-1/response';
const DM_UPDATE_TOPIC = 'iotdm-1/device/update';
const DM_OBSERVE_TOPIC = 'iotdm-1/observe';
const DM_CANCEL_OBSERVE_TOPIC = 'iotdm-1/cancel';
const DM_REBOOT_TOPIC = 'iotdm-1/mgmt/initiate/device/reboot';
const DM_FACTORY_RESET_TOPIC = 'iotdm-1/mgmt/initiate/device/factory_reset';
const DM_FIRMWARE_DOWNLOAD_TOPIC = 'iotdm-1/mgmt/initiate/firmware/download';
const DM_FIRMWARE_UPDATE_TOPIC = 'iotdm-1/mgmt/initiate/firmware/update';

// Regex topic
const DM_REQUEST_RE = /^iotdm-1\/*/;
const DM_ACTION_RE = /^iotdm-1\/mgmt\/initiate\/(.+)\/(.+)$/;

export default class ManagedDeviceClient extends DeviceClient {

  constructor(config){
    super(config);

    if(config.org === QUICKSTART_ORG_ID){
        throw new Error('cannot use quickstart for a managed device');
    }

    this.ResponseCode = {
      SUCCESS: 200,
      ACCEPT: 202,
      CHANGED: 204,
      BADREQUEST: 400,
      NOTFOUND: 404,
      CONFLICT: 409,
      ERROR: 500,
      NOTIMPLEMENTED: 501
    };

    this._deviceRequests = {};
    this._dmRequests = {};
  }

  connect(){
    super.connect();

    var mqtt = this.mqtt;

    this.mqtt.on('connect', () => {
      mqtt.subscribe(DM_WILDCARD_TOPIC, { qos: QOS }, function(){});
    });

    this.mqtt.on('message', (topic, payload) => {
      let match = DM_REQUEST_RE.exec(topic);

      if(match){
        if(topic == DM_RESPONSE_TOPIC){
          this._onDmResponse(payload);
        } else{
          this._onDmRequest(topic, payload);    
        }
      }
    });
  }

  manage(lifetime, supportDeviceActions, supportFirmwareActions, deviceInfo){
    if(!this.isConnected){
      throw new Error("client must be connected");
    }
    
    var d = new Object();

    if(isDefined(lifetime)){
      if(!isNumber(lifetime)){
        throw new Error("lifetime must be a number");
      }

      if(lifetime < 3600){
        throw new Error("lifetime cannot be less than 3600");
      }

      d.lifetime = lifetime;
    }

    if(isDefined(supportDeviceActions) || isDefined(supportFirmwareActions)){      
      d.supports = new Object();
      
      if(isDefined(supportDeviceActions)){
        if(!isBoolean(supportDeviceActions)){
          throw new Error("supportDeviceActions must be a boolean");
        }

        d.supports.deviceActions = supportDeviceActions;
      }

      if(isDefined(supportFirmwareActions)){
        if(!isBoolean(supportFirmwareActions)){
          throw new Error("supportFirmwareActions must be a boolean");
        }

        d.supports.firmwareActions = supportFirmwareActions;
      }
    }

    if(isDefined(deviceInfo)) {
      d.deviceInfo = new Object();

      d.deviceInfo.serialNumber = deviceInfo.serialNumber;
      d.deviceInfo.manufacturer = deviceInfo.manufacturer;
      d.deviceInfo.model = deviceInfo.model;
      d.deviceInfo.deviceClass = deviceInfo.deviceClass;
      d.deviceInfo.description = deviceInfo.description;
      d.deviceInfo.fwVersion = deviceInfo.fwVersion;
      d.deviceInfo.hwVersion = deviceInfo.hwVersion;
      d.deviceInfo.descriptiveLocation = deviceInfo.descriptiveLocation;
    }
	
    var payload = new Object();
    payload.d = d;

    var reqId = generateUUID();
    payload.reqId = reqId;
    payload = JSON.stringify(payload);

    this._deviceRequests[reqId] = {topic : MANAGE_TOPIC, payload : payload};

    this.log.debug("Publishing manage request with payload : %s", payload);
    this.mqtt.publish(MANAGE_TOPIC, payload, QOS);

    return reqId;
  }

  unmanage(){
    if(!this.isConnected){
      throw new Error("client must be connected");
    }

    var payload = new Object();

    var reqId = generateUUID();
    payload.reqId = reqId;
    payload = JSON.stringify(payload);

    this._deviceRequests[reqId] = {topic : UNMANAGE_TOPIC, payload : payload};

    this.log.debug("Publishing unmanage request with payload : %s", payload);
    this.mqtt.publish(UNMANAGE_TOPIC, payload, QOS);

    return reqId;
  }

  updateLocation(longitude, latitude, elevation, accuracy){
    if(!this.isConnected){
      throw new Error("client must be connected");
    }
    
    if(!isDefined(longitude) || !isDefined(latitude)){
      throw new Error("longitude and latitude are required for updating location");
    }

    if(!isNumber(longitude) || !isNumber(latitude)){
      throw new Error("longitude and latitude must be numbers");
    }

    if(longitude < -180 || longitude > 180){
      throw new Error("longitude cannot be less than -180 or greater than 180");
    }

    if(latitude < -90 || latitude > 90){
      throw new Error("latitude cannot be less than -90 or greater than 90");
    }

    var d = new Object();
    d.longitude = longitude;
    d.latitude = latitude;

    if(isDefined(elevation)){
      if(!isNumber(elevation)){
        throw new Error("elevation must be a number");
      }

      d.elevation = elevation;
    }

    if(isDefined(accuracy)){
      if(!isNumber(accuracy)){
        throw new Error("accuracy must be a number");
      }

      d.accuracy = accuracy;
    }

    d.measuredDateTime = new Date().toISOString();

    var payload = new Object();
    payload.d = d;

    var reqId = generateUUID();
    payload.reqId = reqId;
    payload = JSON.stringify(payload);

    this._deviceRequests[reqId] = {topic : UPDATE_LOCATION_TOPIC, payload : payload};
 
    this.log.debug("Publishing update location request with payload : %s", payload);
    this.mqtt.publish(UPDATE_LOCATION_TOPIC, payload, QOS);

    return reqId;
  }

  addErrorCode(errorCode){
    if(!this.isConnected){
      throw new Error("client must be connected");
    }

    if(!isDefined(errorCode)){
      throw new Error("error code is required for adding an error code");
    }

    if(!isNumber(errorCode)){
      throw new Error("error code must be a number");
    }
    
    var d = new Object();
    d.errorCode = errorCode;

    var payload = new Object();
    payload.d = d;

    var reqId = generateUUID();
    payload.reqId = reqId;
    payload = JSON.stringify(payload);

    this._deviceRequests[reqId] = {topic : ADD_ERROR_CODE_TOPIC, payload : payload};

    this.log.debug("Publishing add error code request with payload : %s", payload);
    this.mqtt.publish(ADD_ERROR_CODE_TOPIC, payload, QOS);

    return reqId;
  }

  clearErrorCodes(){
    if(!this.isConnected){
      throw new Error("client must be connected");
    }

    var payload = new Object();

    var reqId = generateUUID();
    payload.reqId = reqId;
    payload = JSON.stringify(payload);

    this._deviceRequests[reqId] = {topic : CLEAR_ERROR_CODES_TOPIC, payload : payload};
 
    this.log.debug("Publishing clear error codes request with payload : %s", payload);
    this.mqtt.publish(CLEAR_ERROR_CODES_TOPIC, payload, QOS);

    return reqId;
  }

  addLog(message, severity, data){
    if(!this.isConnected){
      throw new Error("client must be connected");
    }

    if(!isDefined(message) || !isDefined(severity)){
      throw new Error("message and severity are required for adding a log");
    }

    if(!isString(message)){
      throw new Error("message must be a string");
    }
    
    if(!isNumber(severity)){
      throw new Error("severity must be a number");
    }

    if(!(severity === 0 || severity === 1 || severity === 2)){
      throw new Error("severity can only equal 0, 1, or 2");
    }

    var d = new Object();
    d.message = message;
    d.severity = severity;
    d.timestamp = new Date().toISOString();

    if(isDefined(data)){
      if(!isString(data)){
        throw new Error("data must be a string");
      }

      d.data = data;
    }

    var payload = new Object();
    payload.d = d;

    var reqId = generateUUID();
    payload.reqId = reqId;
    payload = JSON.stringify(payload);

    this._deviceRequests[reqId] = {topic : ADD_LOG_TOPIC, payload : payload};

    this.log.debug("Publishing add log request with payload : %s", payload);
    this.mqtt.publish(ADD_LOG_TOPIC, payload, QOS);

    return reqId;
  }

  clearLogs(){
    if(!this.isConnected){
      throw new Error("client must be connected");
    }

    var payload = new Object();

    var reqId = generateUUID();
    payload.reqId = reqId;
    payload = JSON.stringify(payload);

    this._deviceRequests[reqId] = {topic : CLEAR_LOGS_TOPIC, payload : payload};

    this.log.debug("Publishing clear logs request with payload : %s", payload);
    this.mqtt.publish(CLEAR_LOGS_TOPIC, payload, QOS);

    return reqId;
  }

  publishDeviceNotify(field, value) {
    if(!this.isConnected){
      throw new Error("client must be connected");
    }

    if(!isDefined(field) || !isDefined(value)){
      throw new Error("field and accept are required");
    }

    if(!isString(field)){
      throw new Error("field must be a string");
    }
    
    var payload = new Object();

    var reqId = generateUUID();
    payload.reqId = reqId;
    payload.d = {"fields":[{"field": field, "value": value}]};
    payload = JSON.stringify(payload);
    
    this._deviceRequests[reqId] = {topic: NOTIFY_TOPIC, payload: payload};

    this.log.debug("Publishing device notify with payload : %s", payload);
    this.mqtt.publish(NOTIFY_TOPIC, payload, QOS);

    return this;
  }

  respondDeviceRequest(reqId, responseCode) {
    if(!this.isConnected){
      throw new Error("client must be connected");
    }

    if(!isDefined(reqId) || !isDefined(responseCode)){
      throw new Error("reqId and responseCode are required");
    }

    if(!isString(reqId)){
      throw new Error("reqId must be a string");
    }
    
    if(!isNumber(responseCode)){
      throw new Error("responseCode must be a number");
    }

    var rc = responseCode;
    var payload = new Object();
    payload.rc = rc;
    payload.reqId = reqId;
    payload = JSON.stringify(payload);
    
    this.log.debug("Publishing device request response with payload : %s", payload);
    this.mqtt.publish(RESPONSE_TOPIC, payload, QOS);

    delete this._dmRequests[reqId];

    return this;
  }

  _onDmResponse(payload){
    payload = JSON.parse(payload);
    var reqId = payload.reqId;
    var rc = payload.rc;

    var request = this._deviceRequests[reqId];
    if(!isDefined(request)){
      throw new Error("unknown request : %s", reqId);
    }

    switch(request.topic){
      case MANAGE_TOPIC:
        if(rc == 200){
          this.log.debug("[%s] Manage action completed : %s", rc, request.payload);
        } else{
          this.log.error("[%s] Manage action failed : %s", rc, request.payload); 
        }
        break;
      case UNMANAGE_TOPIC :
        if(rc == 200){
          this.log.debug("[%s] Unmanage action completed : %s", rc, request.payload);
        } else{
          this.log.error("[%s] Unmanage action failed : %s", rc, request.payload); 
        }
        break;
      case UPDATE_LOCATION_TOPIC :
        if(rc == 200){
          this.log.debug("[%s] Update location action completed : %s", rc, request.payload);
        } else{
          this.log.error("[%s] Update location failed : %s", rc, request.payload); 
        }
        break;
      case ADD_LOG_TOPIC :
        if(rc == 200){
          this.log.debug("[%s] Add log action completed : %s", rc, request.payload);
        } else{
          this.log.error("[%s] Add log action failed : %s", rc, request.payload); 
        }
        break;
      case CLEAR_LOGS_TOPIC :
        if(rc == 200){
          this.log.debug("[%s] Clear logs action completed : %s", rc, request.payload);
        } else{
          this.log.error("[%s] Clear logs action failed : %s", rc, request.payload); 
        }
        break;
      case ADD_ERROR_CODE_TOPIC :
        if(rc == 200){
          this.log.debug("[%s] Add error code action completed : %s", rc, request.payload);
        } else{
          this.log.error("[%s] Add error code action failed : %s", rc, request.payload); 
        }
        break;
      case CLEAR_ERROR_CODES_TOPIC :
        if(rc == 200){
          this.log.debug("[%s] Clear error codes action completed : %s", rc, request.payload);
        } else{
          this.log.error("[%s] Clear error codes action failed : %s", rc, request.payload); 
        }
        break;
      case NOTIFY_TOPIC :
        if(rc == 200){
          this.log.debug("[%s] Notify action completed : %s", rc, request.payload);
        } else{
          this.log.error("[%s] Notify action failed : %s", rc, request.payload);
        }
        break;
      default :
        throw new Error("unknown action response");
    }

    this.emit('dmResponse', {
      reqId: reqId,
      rc: rc
    });

    delete this._deviceRequests[reqId];

    return this;
  }

  _onDmRequest(topic, payload){
    payload = JSON.parse(payload);
    var reqId = payload.reqId;

    this._dmRequests[reqId] = {topic : topic, payload : payload};

    let match = DM_ACTION_RE.exec(topic);

    if(match){
      var type = match[1];
      var action = match[2];

      if(type == "firmware"){
        action = type+'_'+action;
      }

      this.emit('dmAction', {
        reqId: reqId,
        action: action
      });
    } else {
      if (topic == DM_UPDATE_TOPIC) {
        this.emit('dmUpdate', payload);
      } else if (topic == DM_OBSERVE_TOPIC) {
        this.emit('dmObserve', payload);
      } else if (topic == DM_CANCEL_OBSERVE_TOPIC) {
        this.emit('dmCancel', payload);
      }
    }

    return this;
  }

}

