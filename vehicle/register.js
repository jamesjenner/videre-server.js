/*
 * register.js
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

var DeviceType = require('../videre-common/js/deviceType.js');

module.exports = VehicleRegister;

function VehicleRegister(options) {
    options = options || {};
}

VehicleRegister.DEVICE_PARROT_V1 = "parrot.v1";
VehicleRegister.DEVICE_PARROT_PX4 = "parrot.px4.mavlink";
VehicleRegister.DEVICE_PX4_ROVER_V1 = "px4.rover.v1";
VehicleRegister.DEVICE_DEMO = "Demo";

var parrotArDroneV1 = require('./parrotArDroneV1.js');
var parrotPx4 = require('./parrotPx4.js');
// var roverPx4V1 = require('./roverPx4V1.js');
// var demo = require('./demo.js');

VehicleRegister.prototype.getList = function() {
    return [
        new DeviceType(VehicleRegister.DEVICE_PARROT_V1, "Parrot v1"),
        new DeviceType(VehicleRegister.DEVICE_PARROT_PX4, "Parrot PX4 (mavlink)"),
        new DeviceType(VehicleRegister.DEVICE_PX4_ROVER_V1, "PX4 Rover v1"),
        new DeviceType(VehicleRegister.DEVICE_DEMO, "Demonstration"),
    ];
}

/**
 * getDriver - get the device driver object 
 */
VehicleRegister.prototype.getDriver = function(deviceName) {
    switch(deviceName) {
	case VehicleRegister.DEVICE_PARROT_V1:
            return parrotArDroneV1;
	    break;

	/* insert new hardware defs here */

	case VehicleRegister.DEVICE_PARROT_PX4:
            return parrotPx4;
	    break;

	case VehicleRegister.DEVICE_PX4_ROVER_V1:
            return roverPx4V1;
	    break;

	case VehicleRegister.DEVICE_DEMO:
            return demo;
	    break;
    }
}
