/*
 * quadCopter.js v0.1 alpha
 *
 * A type of UAV that has four seperate rotors for flight
 *
 * Note that there is not a definition for multiCopter, however this may
 * need to change based on requirements for specfic configurations of 
 * multi rotor copters.
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

var UAV  = require('./uav.js');
var util = require('util');

module.exports = QuadCopter;

function QuadCopter(options) {
    QuadCopter.super_.call(this, options);  // call the super constructr

    options = options || {};
}

QuadCopter.prototype.takeoff = function() {};

QuadCopter.prototype.land = function() {};

QuadCopter.prototype.abort = function() {};

util.inherits(QuadCopter, UAV);
