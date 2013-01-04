/*
 * telemetry.js v0.1 alpha
 *
 * Encapsulates the common telemetry, wrapping it so that it can 
 * be included within node js.
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


var fs = require('fs');

var Position = require('./position.js');
var Attitude = require('./attitude.js');

// load common js files shared with the videre client
eval(fs.readFileSync('./videre-common/js/telemetry.js').toString());

module.exports = Telemetry;
