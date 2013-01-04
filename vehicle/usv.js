/*
 * usv.js v0.1 alpha
 * 
 * Unmanned Surface Vehicle (specifically the surface of water, refer to UGV for unmanned land based vehicles)
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

module.exports = USV;

function USV(options) {
    USV.super_.call(this, options);  // call the super constructr

    options = options || {};
}

util.inherits(USV, UnmannedVehicle);
