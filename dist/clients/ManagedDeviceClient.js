(function (global, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['exports', 'module', 'format', '../util/util.js', './DeviceClient.js'], factory);
  } else if (typeof exports !== 'undefined' && typeof module !== 'undefined') {
    factory(exports, module, require('format'), require('../util/util.js'), require('./DeviceClient.js'));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod.exports, mod, global.format, global.util, global.DeviceClient);
    global.ManagedDeviceClient = mod.exports;
  }
})(this, function (exports, module, _format, _utilUtilJs, _DeviceClientJs) {
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
  'use strict';

  var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

  var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

  function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

  function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

  function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

  var _format2 = _interopRequireDefault(_format);

  var _DeviceClient2 = _interopRequireDefault(_DeviceClientJs);

  var QUICKSTART_ORG_ID = 'quickstart';
  var QOS = 1;

  // Publish MQTT topics
  var RESPONSE_TOPIC = 'iotdevice-1/response';
  var MANAGE_TOPIC = 'iotdevice-1/mgmt/manage';
  var UNMANAGE_TOPIC = 'iotdevice-1/mgmt/unmanage';
  var UPDATE_LOCATION_TOPIC = 'iotdevice-1/device/update/location';
  var ADD_LOG_TOPIC = 'iotdevice-1/add/diag/log';
  var CLEAR_LOGS_TOPIC = 'iotdevice-1/clear/diag/log';
  var ADD_ERROR_CODE_TOPIC = 'iotdevice-1/add/diag/errorCodes';
  var CLEAR_ERROR_CODES_TOPIC = 'iotdevice-1/clear/diag/errorCodes';
  var NOTIFY_TOPIC = 'iotdevice-1/notify';

  // Subscribe MQTT topics
  var DM_WILDCARD_TOPIC = 'iotdm-1/#';
  var DM_RESPONSE_TOPIC = 'iotdm-1/response';
  var DM_UPDATE_TOPIC = 'iotdm-1/device/update';
  var DM_OBSERVE_TOPIC = 'iotdm-1/observe';
  var DM_CANCEL_OBSERVE_TOPIC = 'iotdm-1/cancel';
  var DM_REBOOT_TOPIC = 'iotdm-1/mgmt/initiate/device/reboot';
  var DM_FACTORY_RESET_TOPIC = 'iotdm-1/mgmt/initiate/device/factory_reset';
  var DM_FIRMWARE_DOWNLOAD_TOPIC = 'iotdm-1/mgmt/initiate/firmware/download';
  var DM_FIRMWARE_UPDATE_TOPIC = 'iotdm-1/mgmt/initiate/firmware/update';

  // Regex topic
  var DM_REQUEST_RE = /^iotdm-1\/*/;
  var DM_ACTION_RE = /^iotdm-1\/mgmt\/initiate\/(.+)\/(.+)$/;

  var ManagedDeviceClient = (function (_DeviceClient) {
    _inherits(ManagedDeviceClient, _DeviceClient);

    function ManagedDeviceClient(config) {
      _classCallCheck(this, ManagedDeviceClient);

      _get(Object.getPrototypeOf(ManagedDeviceClient.prototype), 'constructor', this).call(this, config);

      if (config.org === QUICKSTART_ORG_ID) {
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

    _createClass(ManagedDeviceClient, [{
      key: 'connect',
      value: function connect() {
        var _this = this;

        _get(Object.getPrototypeOf(ManagedDeviceClient.prototype), 'connect', this).call(this);

        var mqtt = this.mqtt;

        this.mqtt.on('connect', function () {
          mqtt.subscribe(DM_WILDCARD_TOPIC, { qos: QOS }, function () {});
        });

        this.mqtt.on('message', function (topic, payload) {
          var match = DM_REQUEST_RE.exec(topic);

          if (match) {
            if (topic == DM_RESPONSE_TOPIC) {
              _this._onDmResponse(payload);
            } else {
              _this._onDmRequest(topic, payload);
            }
          }
        });
      }
    }, {
      key: 'manage',
      value: function manage(lifetime, supportDeviceActions, supportFirmwareActions, deviceInfo) {
        if (!this.isConnected) {
          throw new Error("client must be connected");
        }

        var d = new Object();

        if ((0, _utilUtilJs.isDefined)(lifetime)) {
          if (!(0, _utilUtilJs.isNumber)(lifetime)) {
            throw new Error("lifetime must be a number");
          }

          if (lifetime < 3600) {
            throw new Error("lifetime cannot be less than 3600");
          }

          d.lifetime = lifetime;
        }

        if ((0, _utilUtilJs.isDefined)(supportDeviceActions) || (0, _utilUtilJs.isDefined)(supportFirmwareActions)) {
          d.supports = new Object();

          if ((0, _utilUtilJs.isDefined)(supportDeviceActions)) {
            if (!(0, _utilUtilJs.isBoolean)(supportDeviceActions)) {
              throw new Error("supportDeviceActions must be a boolean");
            }

            d.supports.deviceActions = supportDeviceActions;
          }

          if ((0, _utilUtilJs.isDefined)(supportFirmwareActions)) {
            if (!(0, _utilUtilJs.isBoolean)(supportFirmwareActions)) {
              throw new Error("supportFirmwareActions must be a boolean");
            }

            d.supports.firmwareActions = supportFirmwareActions;
          }
        }

        if ((0, _utilUtilJs.isDefined)(deviceInfo)) {
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

        var reqId = (0, _utilUtilJs.generateUUID)();
        payload.reqId = reqId;
        payload = JSON.stringify(payload);

        this._deviceRequests[reqId] = { topic: MANAGE_TOPIC, payload: payload };

        this.log.debug("Publishing manage request with payload : %s", payload);
        this.mqtt.publish(MANAGE_TOPIC, payload, QOS);

        return reqId;
      }
    }, {
      key: 'unmanage',
      value: function unmanage() {
        if (!this.isConnected) {
          throw new Error("client must be connected");
        }

        var payload = new Object();

        var reqId = (0, _utilUtilJs.generateUUID)();
        payload.reqId = reqId;
        payload = JSON.stringify(payload);

        this._deviceRequests[reqId] = { topic: UNMANAGE_TOPIC, payload: payload };

        this.log.debug("Publishing unmanage request with payload : %s", payload);
        this.mqtt.publish(UNMANAGE_TOPIC, payload, QOS);

        return reqId;
      }
    }, {
      key: 'updateLocation',
      value: function updateLocation(longitude, latitude, elevation, accuracy) {
        if (!this.isConnected) {
          throw new Error("client must be connected");
        }

        if (!(0, _utilUtilJs.isDefined)(longitude) || !(0, _utilUtilJs.isDefined)(latitude)) {
          throw new Error("longitude and latitude are required for updating location");
        }

        if (!(0, _utilUtilJs.isNumber)(longitude) || !(0, _utilUtilJs.isNumber)(latitude)) {
          throw new Error("longitude and latitude must be numbers");
        }

        if (longitude < -180 || longitude > 180) {
          throw new Error("longitude cannot be less than -180 or greater than 180");
        }

        if (latitude < -90 || latitude > 90) {
          throw new Error("latitude cannot be less than -90 or greater than 90");
        }

        var d = new Object();
        d.longitude = longitude;
        d.latitude = latitude;

        if ((0, _utilUtilJs.isDefined)(elevation)) {
          if (!(0, _utilUtilJs.isNumber)(elevation)) {
            throw new Error("elevation must be a number");
          }

          d.elevation = elevation;
        }

        if ((0, _utilUtilJs.isDefined)(accuracy)) {
          if (!(0, _utilUtilJs.isNumber)(accuracy)) {
            throw new Error("accuracy must be a number");
          }

          d.accuracy = accuracy;
        }

        d.measuredDateTime = new Date().toISOString();

        var payload = new Object();
        payload.d = d;

        var reqId = (0, _utilUtilJs.generateUUID)();
        payload.reqId = reqId;
        payload = JSON.stringify(payload);

        this._deviceRequests[reqId] = { topic: UPDATE_LOCATION_TOPIC, payload: payload };

        this.log.debug("Publishing update location request with payload : %s", payload);
        this.mqtt.publish(UPDATE_LOCATION_TOPIC, payload, QOS);

        return reqId;
      }
    }, {
      key: 'addErrorCode',
      value: function addErrorCode(errorCode) {
        if (!this.isConnected) {
          throw new Error("client must be connected");
        }

        if (!(0, _utilUtilJs.isDefined)(errorCode)) {
          throw new Error("error code is required for adding an error code");
        }

        if (!(0, _utilUtilJs.isNumber)(errorCode)) {
          throw new Error("error code must be a number");
        }

        var d = new Object();
        d.errorCode = errorCode;

        var payload = new Object();
        payload.d = d;

        var reqId = (0, _utilUtilJs.generateUUID)();
        payload.reqId = reqId;
        payload = JSON.stringify(payload);

        this._deviceRequests[reqId] = { topic: ADD_ERROR_CODE_TOPIC, payload: payload };

        this.log.debug("Publishing add error code request with payload : %s", payload);
        this.mqtt.publish(ADD_ERROR_CODE_TOPIC, payload, QOS);

        return reqId;
      }
    }, {
      key: 'clearErrorCodes',
      value: function clearErrorCodes() {
        if (!this.isConnected) {
          throw new Error("client must be connected");
        }

        var payload = new Object();

        var reqId = (0, _utilUtilJs.generateUUID)();
        payload.reqId = reqId;
        payload = JSON.stringify(payload);

        this._deviceRequests[reqId] = { topic: CLEAR_ERROR_CODES_TOPIC, payload: payload };

        this.log.debug("Publishing clear error codes request with payload : %s", payload);
        this.mqtt.publish(CLEAR_ERROR_CODES_TOPIC, payload, QOS);

        return reqId;
      }
    }, {
      key: 'addLog',
      value: function addLog(message, severity, data) {
        if (!this.isConnected) {
          throw new Error("client must be connected");
        }

        if (!(0, _utilUtilJs.isDefined)(message) || !(0, _utilUtilJs.isDefined)(severity)) {
          throw new Error("message and severity are required for adding a log");
        }

        if (!(0, _utilUtilJs.isString)(message)) {
          throw new Error("message must be a string");
        }

        if (!(0, _utilUtilJs.isNumber)(severity)) {
          throw new Error("severity must be a number");
        }

        if (!(severity === 0 || severity === 1 || severity === 2)) {
          throw new Error("severity can only equal 0, 1, or 2");
        }

        var d = new Object();
        d.message = message;
        d.severity = severity;
        d.timestamp = new Date().toISOString();

        if ((0, _utilUtilJs.isDefined)(data)) {
          if (!(0, _utilUtilJs.isString)(data)) {
            throw new Error("data must be a string");
          }

          d.data = data;
        }

        var payload = new Object();
        payload.d = d;

        var reqId = (0, _utilUtilJs.generateUUID)();
        payload.reqId = reqId;
        payload = JSON.stringify(payload);

        this._deviceRequests[reqId] = { topic: ADD_LOG_TOPIC, payload: payload };

        this.log.debug("Publishing add log request with payload : %s", payload);
        this.mqtt.publish(ADD_LOG_TOPIC, payload, QOS);

        return reqId;
      }
    }, {
      key: 'clearLogs',
      value: function clearLogs() {
        if (!this.isConnected) {
          throw new Error("client must be connected");
        }

        var payload = new Object();

        var reqId = (0, _utilUtilJs.generateUUID)();
        payload.reqId = reqId;
        payload = JSON.stringify(payload);

        this._deviceRequests[reqId] = { topic: CLEAR_LOGS_TOPIC, payload: payload };

        this.log.debug("Publishing clear logs request with payload : %s", payload);
        this.mqtt.publish(CLEAR_LOGS_TOPIC, payload, QOS);

        return reqId;
      }
    }, {
      key: 'publishDeviceNotify',
      value: function publishDeviceNotify(field, value) {
        if (!this.isConnected) {
          throw new Error("client must be connected");
        }

        if (!(0, _utilUtilJs.isDefined)(field) || !(0, _utilUtilJs.isDefined)(value)) {
          throw new Error("field and accept are required");
        }

        if (!(0, _utilUtilJs.isString)(field)) {
          throw new Error("field must be a string");
        }

        var payload = new Object();

        var reqId = (0, _utilUtilJs.generateUUID)();
        payload.reqId = reqId;
        payload.d = { "fields": [{ "field": field, "value": value }] };
        payload = JSON.stringify(payload);

        this._deviceRequests[reqId] = { topic: NOTIFY_TOPIC, payload: payload };

        this.log.debug("Publishing device notify with payload : %s", payload);
        this.mqtt.publish(NOTIFY_TOPIC, payload, QOS);

        return this;
      }
    }, {
      key: 'respondDeviceRequest',
      value: function respondDeviceRequest(reqId, responseCode) {
        if (!this.isConnected) {
          throw new Error("client must be connected");
        }

        if (!(0, _utilUtilJs.isDefined)(reqId) || !(0, _utilUtilJs.isDefined)(responseCode)) {
          throw new Error("reqId and responseCode are required");
        }

        if (!(0, _utilUtilJs.isString)(reqId)) {
          throw new Error("reqId must be a string");
        }

        if (!(0, _utilUtilJs.isNumber)(responseCode)) {
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
    }, {
      key: '_onDmResponse',
      value: function _onDmResponse(payload) {
        payload = JSON.parse(payload);
        var reqId = payload.reqId;
        var rc = payload.rc;

        var request = this._deviceRequests[reqId];
        if (!(0, _utilUtilJs.isDefined)(request)) {
          throw new Error("unknown request : %s", reqId);
        }

        switch (request.topic) {
          case MANAGE_TOPIC:
            if (rc == 200) {
              this.log.debug("[%s] Manage action completed : %s", rc, request.payload);
            } else {
              this.log.error("[%s] Manage action failed : %s", rc, request.payload);
            }
            break;
          case UNMANAGE_TOPIC:
            if (rc == 200) {
              this.log.debug("[%s] Unmanage action completed : %s", rc, request.payload);
            } else {
              this.log.error("[%s] Unmanage action failed : %s", rc, request.payload);
            }
            break;
          case UPDATE_LOCATION_TOPIC:
            if (rc == 200) {
              this.log.debug("[%s] Update location action completed : %s", rc, request.payload);
            } else {
              this.log.error("[%s] Update location failed : %s", rc, request.payload);
            }
            break;
          case ADD_LOG_TOPIC:
            if (rc == 200) {
              this.log.debug("[%s] Add log action completed : %s", rc, request.payload);
            } else {
              this.log.error("[%s] Add log action failed : %s", rc, request.payload);
            }
            break;
          case CLEAR_LOGS_TOPIC:
            if (rc == 200) {
              this.log.debug("[%s] Clear logs action completed : %s", rc, request.payload);
            } else {
              this.log.error("[%s] Clear logs action failed : %s", rc, request.payload);
            }
            break;
          case ADD_ERROR_CODE_TOPIC:
            if (rc == 200) {
              this.log.debug("[%s] Add error code action completed : %s", rc, request.payload);
            } else {
              this.log.error("[%s] Add error code action failed : %s", rc, request.payload);
            }
            break;
          case CLEAR_ERROR_CODES_TOPIC:
            if (rc == 200) {
              this.log.debug("[%s] Clear error codes action completed : %s", rc, request.payload);
            } else {
              this.log.error("[%s] Clear error codes action failed : %s", rc, request.payload);
            }
            break;
          case NOTIFY_TOPIC:
            if (rc == 200) {
              this.log.debug("[%s] Notify action completed : %s", rc, request.payload);
            } else {
              this.log.error("[%s] Notify action failed : %s", rc, request.payload);
            }
            break;
          default:
            throw new Error("unknown action response");
        }

        this.emit('dmResponse', {
          reqId: reqId,
          rc: rc
        });

        delete this._deviceRequests[reqId];

        return this;
      }
    }, {
      key: '_onDmRequest',
      value: function _onDmRequest(topic, payload) {
        payload = JSON.parse(payload);
        var reqId = payload.reqId;

        this._dmRequests[reqId] = { topic: topic, payload: payload };

        var match = DM_ACTION_RE.exec(topic);

        if (match) {
          var type = match[1];
          var action = match[2];

          if (type == "firmware") {
            action = type + '_' + action;
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
    }]);

    return ManagedDeviceClient;
  })(_DeviceClient2['default']);

  module.exports = ManagedDeviceClient;
});