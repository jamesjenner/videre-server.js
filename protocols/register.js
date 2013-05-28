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

module.exports = ProtocolRegister;

function ProtocolRegister(options) {
    options = options || {};
}

ProtocolRegister.PROTOCOL_PARROT_V1 = "parrot.v1";
ProtocolRegister.PROTOCOL_MAVLINK_GENERIC = "mavlink.generic";

var MavlinkProtocol = require('./mavlinkProtocol.js');
// var ParrotV1Protocol = require('./parrotV1.js');
// var Demo = require('./demo.js');

ProtocolRegister.prototype.getList = function() {
    return [
        ProtocolRegister.PROTOCOL_MAVLINK_GENERIC,
        ProtocolRegister.PROTOCOL_PARROT_V1,
    ];
}

ProtocolRegister.prototype.getText = function() {
    return (
        ProtocolRegister.PROTOCOL_MAVLINK_GENERIC + ", "  +
        ProtocolRegister.PROTOCOL_PARROT_V1
    );
}

ProtocolRegister.prototype.validateProtocolId = function(id) {
    if(id !== ProtocolRegister.PROTOCOL_MAVLINK_GENERIC && id !== ProtocolRegister.PROTOCOL_PARROT_V1) {
	return false;
    }
    return true;
}

/**
 * getDriver - get the device driver object 
 */
ProtocolRegister.prototype.getProtocol = function(protocolId) {
    switch(protocolId) {
	case ProtocolRegister.PROTOCOL_MAVLINK_GENERIC:
            return MavlinkProtocol;
	    break;

	case ProtocolRegister.PROTOCOL_PARROT_V1:
            // return ParrotV1Protocol;
	    break;

	/* insert new hardware defs here */
    }
    return "";
}
