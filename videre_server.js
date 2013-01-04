/*
 * videre_server.js v0.1 alpha
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

var videre_comms  = require('./videre-common/js/videre_comms.js');
var vehicle       = require('./videre-common/js/vehicle.js');
var client_comms  = require('./client_comms.js');
// var vehicle_comms = require('./vehicle_comms.js');

// var RemoteVehicle = require('./vehicle_comms.js').RemoteVehicle;
// var parrot = require('./parrotArDrone.js').ParrotARDrone;

// var test = exports;
// exports.Parrot = require('./parrotArDrone.js');
var Parrot = require('./vehicle/parrotArDroneV1.js');

// var remoteVehicle = parrotARDrone.createVehicle();
// var remoteVehicle = new test.Parrot({address: "192.168.1.3"});
var remoteVehicle = new Parrot({address: "192.168.1.3"});

remoteVehicle.on('telemetry', function(d) {processTelemetry(d);});

remoteVehicle.testRun();

function processTelemetry(d) {
    console.log('videre-server: telemetry...');
    console.log(d);
}

// add a watchdog to check if vehicles get added


// if a vehicle is added then check to see if it should be configured


// capture telemetry and pass to the clients


// capture payload and pass to the clients

// note: some devices may pass payload and telemetry together
