/*
 * transformDemo.js
 *
 * Copyright (c) 2013 James G Jenner
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

var fs        = require('fs');
var util      = require('util');

var Transform = require('./transform.js');
var Telemetry = require('../../videre-common/js/telemetry.js');

module.exports = TransformDemo;

util.inherits(TransformDemo, ClientTransform);

function TransformDemo() {
}

TransformDemo.prototype.transformTelemetry = function(d) {
    var telemetry = new Telemetry();

    // check if we can just pass d as the Telemetry
    telemetry.state = d.state;
    telemetry.speed = d.speed;
    telemetry.velocity.x = d.velocity.x ;
    telemetry.velocity.y = d.velocity.y ;
    telemetry.velocity.z = d.velocity.z ;
    telemetry.attitude.pitch = d.attitude.pitch;
    telemetry.attitude.roll = d.attitude.roll;
    telemetry.attitude.yaw = d.attitude.yaw;
    telemetry.attitude.x = d.attitude.x;
    telemetry.attitude.y = d.attitude.y;
    telemetry.attitude.z = d.attitude.z;
    telemetry.altitude = d.altitude;
    telemetry.temperature = d.temperature;
    telemetry.heading = telemetry.heading
    telemetry.vsi = d.vsi;
    telemetry.position.latitude = d.position.latitude;
    telemetry.position.longitude = d.position.longitude;
    telemetry.batteryVoltage = d.batteryVoltage;
    telemetry.batteryCharge = d.batteryCharge;

    return telemetry;
}

