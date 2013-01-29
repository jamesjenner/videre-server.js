/*
 * transformParrotArDroneV1.js
 *
 * Copyright (c) 2012 James G Jenner
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see http://www.gnu.org/licenses/
 */

var fs              = require('fs');
var util            = require('util');

var ClientTransform = require('./clientTransform.js');
var Telemetry       = require('./clientTransform.js');

var Telemetry       = require('../videre-common/js/telemetry.js');

module.exports = TransformParrotArDroneV1;

util.inherits(TransformParrotArDroneV1, ClientTransform);

function TransformParrotArDroneV1() {
}

TransformParrotArDroneV1.CTRL_DEFAULT = 'CTRL_DEFAULT';
TransformParrotArDroneV1.CTRL_INIT = 'CTRL_INIT';
TransformParrotArDroneV1.CTRL_LANDED = 'CTRL_LANDED';
TransformParrotArDroneV1.CTRL_FLYING = 'CTRL_FLYING';
TransformParrotArDroneV1.CTRL_HOVERING = 'CTRL_HOVERING';
TransformParrotArDroneV1.CTRL_TEST = 'CTRL_TEST';
TransformParrotArDroneV1.CTRL_TRANS_TAKEOFF = 'CTRL_TRANS_TAKEOFF';
TransformParrotArDroneV1.CTRL_TRANS_GOTOFIX = 'CTRL_TRANS_GOTOFIX';
TransformParrotArDroneV1.CTRL_TRANS_LANDING = 'CTRL_TRANS_LANDING';
TransformParrotArDroneV1.CTRL_TRANS_LOOPING = 'CTRL_TRANS_LOOPING';


TransformParrotArDroneV1.prototype.transform = function(d) {
    var telemetry = new Telemetry();

    var data = {};

    data.state = d.state || TransformParrotArDroneV1.CTRL_DEFAULT;

    switch(d.state) {
        case TransformParrotArDroneV1.CTRL_DEFAULT:
	    telemetry.state = Telemetry.STATE_UNKNOWN;
	    break;

        case TransformParrotArDroneV1.CTRL_INIT:
	    telemetry.state = Telemetry.STATE_IDLE;
	    break;

        case TransformParrotArDroneV1.CTRL_LANDED:
	    telemetry.state = Telemetry.STATE_LANDED;
	    break;

        case TransformParrotArDroneV1.CTRL_FLYING:
	    telemetry.state = Telemetry.STATE_FLYING;
	    break;

        case TransformParrotArDroneV1.CTRL_HOVERING:
	    telemetry.state = Telemetry.STATE_HOVERING;
	    break;

        case TransformParrotArDroneV1.CTRL_TEST:
	    telemetry.state = Telemetry.STATE_TEST_MODE;
	    break;

        case TransformParrotArDroneV1.CTRL_TRANS_TAKEOFF:
	    telemetry.state = Telemetry.STATE_TAKING_OFF;
	    break;

        case TransformParrotArDroneV1.CTRL_TRANS_GOTOFIX:
	    telemetry.state = Telemetry.STATE_AUTONOMOUS;
	    break;

        case TransformParrotArDroneV1.CTRL_TRANS_LANDING:
	    telemetry.state = Telemetry.STATE_LANDING;
	    break;

        case TransformParrotArDroneV1.CTRL_TRANS_LOOPING:
	    telemetry.state = Telemetry.STATE_AUTONOMOUS;
	    break;
    }

    // speed is mm/s, so divide by 1000 to get m/s
    telemetry.speed = d.speed / 1000;

    // uknown uom, presuming mm/s (same as speed)
    telemetry.velocity.x = d.velocity.x / 1000;
    telemetry.velocity.y = d.velocity.y / 1000;
    telemetry.velocity.z = d.velocity.z / 1000;

    // attitude is milli degrees, multiply by 1000 to get degrees
    // testing has shown that it's in degrees not milli degrees, perhaps they changed it for v2?
    telemetry.attitude.pitch = d.attitude.pitch;
    telemetry.attitude.roll = d.attitude.roll;
    telemetry.attitude.yaw = d.attitude.yaw;
    telemetry.attitude.x = d.attitude.pitch;
    telemetry.attitude.y = d.attitude.roll;
    telemetry.attitude.z = d.attitude.yaw;

    // altitude is in cm, convert to m
    // testing has shown that it's m not cm, perhaps they changed it for v2?
    telemetry.altitude = d.altitude;

    // uknown uom
    telemetry.temperature = d.temperature;

    // uknown, presuming it is not available in v1, so lets use yaw.
    // yaw is from -180 to +180, so convert, if < 0 abs and double, otherwise leave as is
    telemetry.heading = telemetry.attitude.yaw < 0 ? telemetry.attitude.yaw * -2 : telemetry.attitude.yaw;

    // uknown uom, presuming it is m/s 
    telemetry.vsi = d.vsi;

    // uknown uom
    telemetry.position.latitude = d.position.latitude;
    telemetry.position.longitude = d.position.longitude;

    // voltage is mV
    telemetry.batteryVoltage = d.batteryVoltage;

    // charge is percentage, 0 to 100
    telemetry.batteryCharge = d.batteryCharge;

    return telemetry;
}

