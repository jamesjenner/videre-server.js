/*
 * uav.js v0.1 alpha
 * 
 * Unmanned Aerial Vehicle
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

var UnmannedVehicle  = require('./unmannedVehicle.js');
var util = require('util');

module.exports = UAV;

function UAV(options) {
    UAV.super_.call(this, options);  // call the super constructr

    options = options || {};
}

util.inherits(UAV, UnmannedVehicle);
