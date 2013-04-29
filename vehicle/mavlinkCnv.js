/*
 * mavlinkCnv.js
 * 
 * Mavlink conversion utility to convert between videre and mavlink format 
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

var Attitude        = require('../videre-common/js/attitude');
var Point           = require('../videre-common/js/point');
var Position        = require('../videre-common/js/position');
var Telemetry       = require('../videre-common/js/telemetry');

module.exports = MavlinkCnv;

var mavlink = require('../implementations/mavlink_common_v1.0');

function MavlinkCnv(options) {
}

/**
 * convert waypoints in videre format to mavlink format
 */
MavlinkCnv.waypointsVtoM = function(waypoints) {
    var newWaypoints = new Array();

    // TODO: add support for frame
    for(var i = 0, l = waypoints.length; i < l; i++) {
	newWaypoints[i] = {};

	waypoints[i]
	newWaypoints[i].seq = i;
	newWaypoints[i].x = waypoints[i].position.latitude;
	newWaypoints[i].y = waypoints[i].position.longitude;
	newWaypoints[i].z = waypoints[i].altitude;
	newWaypoints[i].frame = 0;
	newWaypoints[i].current = 0;
	newWaypoints[i].autocontinue = waypoints[i].autoContinue;
	newWaypoints[i].param1 = 0;
	newWaypoints[i].param2 = 0;
	newWaypoints[i].param3 = 0;
	newWaypoints[i].param4 = 0;

	if(waypoints[i].returnHome) {
	    newWaypoints[i].command = mavlink.MAV_CMD_NAV_RETURN_TO_LAUNCH;
	} else if(waypoints[i].start) {
	    newWaypoints[i].command = mavlink.MAV_CMD_NAV_TAKEOFF;
	    newWaypoints[i].param1 = waypoints[i].pitch;
	    newWaypoints[i].param4 = waypoints[i].yaw;
	} else if(waypoints[i].terminus || waypoints[i].stop) {
	    newWaypoints[i].command = mavlink.MAV_CMD_NAV_LAND;
	    newWaypoints[i].param4 = waypoints[i].yaw;
	} else if(waypoints[i].loiter) {
	    if(waypoints[i].loiterTime > 0) {
		newWaypoints[i].command = mavlink.MAV_CMD_NAV_LOITER_TIME;
		newWaypoints[i].param1 = waypoints[i].loiterTime;
		newWaypoints[i].param3 = waypoints[i].loiterRadius;
		newWaypoints[i].param4 = waypoints[i].yaw;
	    }

	    if(waypoints[i].loiterLaps > 0) {
		newWaypoints[i].command = mavlink.MAV_CMD_NAV_LOITER_TURNS;
		newWaypoints[i].param1 = waypoints[i].loiterLaps;
		newWaypoints[i].param3 = waypoints[i].loiterRadius;
		newWaypoints[i].param4 = waypoints[i].yaw;
	    }

	    if(!waypoints[i].autoContinue) {
		newWaypoints[i].command = mavlink.MAV_CMD_NAV_LOITER_UNLIM;
		newWaypoints[i].param3 = waypoints[i].loiterRadius;
		newWaypoints[i].param4 = waypoints[i].yaw;
	    }
	} else {
	    newWaypoints[i].command = mavlink.MAV_CMD_NAV_WAYPOINT;
	    newWaypoints[i].param1 = waypoints[i].loiterTime;
	    newWaypoints[i].param2 = waypoints[i].accuracy;
	    newWaypoints[i].param3 = waypoints[i].loiterRadius;
	    newWaypoints[i].param4 = waypoints[i].yaw;
	}
    }

    return newWaypoints;
}

/**
 * convert waypoints in mavlink format to videre format
 */
MavlinkCnv.waypointsMtoV = function(waypoints) {
    var newWaypoints = new Array();

    // TODO: if we receive a MAV_CMD_NAV_LAST then we should ignore as it's just a holder,
    // it may be that it is used internally and not actually communicated between systems
    
    // TODO: extend support beyond the nav commands listed below
    
    // TODO: add support for frame
    
    var ignore = false;
    for(var i = 0, l = waypoints.length; i < l; i++) {
	var point = new Point(waypoints[i].x, waypoints[i].y, {
	    sequence: waypoints[i].seq,
	    current: waypoints[i].current === 1 ? true : false,
	    altitude: waypoints[i].z,
	    isHome: false,
	    loiter: false,
	    loiterTime: 0,
	    loiterRadius: 0,
	    returnHome: false,
	    terminus: false,
	});
        ignore = false;

	switch(waypoints[i].command) {
	    case mavlink.MAV_CMD_NAV_RETURN_TO_LAUNCH:
		point.returnHome = true;
		break;

	    case mavlink.MAV_CMD_NAV_TAKEOFF:
		point.start = true;
		point.pitch = waypoints[i].param1;
		point.yaw = waypoints[i].param4;
		break;

	    case mavlink.MAV_CMD_NAV_LAND:
		point.yaw = waypoints[i].param4;
		point.terminus = true;
		point.stop = true;
		break;

	    case mavlink.MAV_CMD_NAV_LOITER_TIME:
		point.loiter = true;
		point.loiterTime = waypoints[i].param1;
		point.loiterRadius = waypoints[i].param3;
		point.yaw = waypoints[i].param4;
		break;

	    case mavlink.MAV_CMD_NAV_LOITER_TURNS:
		point.loiter = true;
		point.loiterLaps = waypoints[i].param1;
		point.loiterRadius = waypoints[i].param3;
		point.yaw = waypoints[i].param4;
		break;

	    case mavlink.MAV_CMD_NAV_LOITER_UNLIM:
		point.loiter = true;
		point.loiterRadius = waypoints[i].param3;
		point.autoContinue = false;
		point.yaw = waypoints[i].param4;
		break;

	    case mavlink.MAV_CMD_NAV_WAYPOINT:
		// while a loiter time and radius can be defined, this has to be handled 
		// differently to a loiter command, as mavlink seperates out waypoint and
		// loitering. The only diff is that a waypoint has an accuracy, which a 
		// loiter time/turns/unlimited doesn't have. Seems redundant, but that's 
		// how they do things.
		point.loiter = false;
		point.loiterTime = waypoints[i].param1;
		point.loiterRadius = waypoints[i].param3;
		point.accuracy = waypoints[i].param2;
		point.yaw = waypoints[i].param4;
		break;

	    default:
		ignore = true;
		// currently unsupported, so ignore for now
	}

	if(!ignore) {
	    newWaypoints.push(point);
	}
    }

    return newWaypoints;
}


