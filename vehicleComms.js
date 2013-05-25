/*
 * vehicleComms.js
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

var fs   = require('fs');
var Comm = require('./videre-common/js/comm.js');

module.exports = VehicleComms;

function VehicleComms(options) {
    options = options || {};

    this.debug = ((options.debug != null) ? options.debug : false);
    this.filename = ((options.filename != null) ? options.filename : "none");

    this.list = new Array();
}

VehicleComms.prototype.getById = function(id) {
    var idx = findObjectById(this.list, id);

    if(idx > -1) {
	return this.list(idx);
    } else {
	return null;
    }
}

VehicleComms.prototype.getList = function() {
    return this.list;
}

VehicleComms.prototype.exists = function(comm) {
    if(comm === null) {
	return false;
    }

    for(var i = 0, l = this.list.length; i < l; i++) {
	if(this.list[i].equals(comm)) {
	    return true;
	}
    }
			
    return false;
}
    
VehicleComms.prototype.add = function(comm) {
    this.list.push(comm);
}

VehicleComms.prototype.remove = function(comm) {
    var idx = -1;
    
    if(comm.id === null || comm.id === undefined) {
	for(var i = 0, l = this.list.length; i < l; i++) {
	    if(this.list[i].equals(comm)) {
		idx = i;
	    }
	}
    } else {
	idx = findObjectById(this.list, comm.id);
    }

    if(idx === -1) {
	return false;
    }

    this.list.splice(idx, 1);

    return true;
}

/* 
 * load comms
 */
VehicleComms.prototype.load = function() {
    this.list = new Array();

    try {
	var dataJSON = JSON.parse(fs.readFileSync(this.filename));

	// the received JSON data will be object, not user instances, so convert
	// TODO: is this really required?

	for(i = 0, l = dataJSON.length; i < l; i++) {
	    this.list.push(new Comm(dataJSON[i]));
	}
    } catch(err) {
	return false;
    }

    return true;
}

/* 
 * save comms
 */
VehicleComms.prototype.save = function() {
    fs.writeFileSync(this.filename, JSON.stringify(this.list, null, '\t'));
}

/** 
 *  find object by id - finds an object based on it's id
 *
 *  returns -1 if not found, otherwise the index in the array
 */
function findObjectById(object, id) {
    var index = -1;

    // if name isn't set then return
    if(!id) {
	return index;
    }

    for(var i = 0, l = object.length; i < l; i++) {
	if(object[i].id === id) {
	    index = i;
	    break;
	}
    }
			
    return index;
}
