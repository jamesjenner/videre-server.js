/*
MAVLink protocol implementation for node.js (auto-generated by mavgen_javascript.py)

Generated from: minimal.xml

Note: this file has been auto-generated. DO NOT EDIT
*/

jspack = require("../lib/node-jspack-master/jspack.js").jspack,
    mavutil = require("../lib/mavutil.js"),
    _ = require("underscore"),
    events = require("events"),
    util = require("util");

// Add a convenience method to Buffer
Buffer.prototype.toByteArray = function () {
  return Array.prototype.slice.call(this, 0)
}

mavlink = function(){};

mavlink.WIRE_PROTOCOL_VERSION = "1.0";

mavlink.MAVLINK_TYPE_CHAR     = 0
mavlink.MAVLINK_TYPE_UINT8_T  = 1
mavlink.MAVLINK_TYPE_INT8_T   = 2
mavlink.MAVLINK_TYPE_UINT16_T = 3
mavlink.MAVLINK_TYPE_INT16_T  = 4
mavlink.MAVLINK_TYPE_UINT32_T = 5
mavlink.MAVLINK_TYPE_INT32_T  = 6
mavlink.MAVLINK_TYPE_UINT64_T = 7
mavlink.MAVLINK_TYPE_INT64_T  = 8
mavlink.MAVLINK_TYPE_FLOAT    = 9
mavlink.MAVLINK_TYPE_DOUBLE   = 10

// Mavlink headers incorporate sequence, source system (platform) and source component. 
mavlink.header = function(msgId, mlen, seq, srcSystem, srcComponent) {

    this.mlen = ( typeof mlen === 'undefined' ) ? 0 : mlen;
    this.seq = ( typeof seq === 'undefined' ) ? 0 : seq;
    this.srcSystem = ( typeof srcSystem === 'undefined' ) ? 0 : srcSystem;
    this.srcComponent = ( typeof srcComponent === 'undefined' ) ? 0 : srcComponent;
    this.msgId = msgId

}

mavlink.header.prototype.pack = function() {
    return jspack.Pack('BBBBBB', [254, this.mlen, this.seq, this.srcSystem, this.srcComponent, this.msgId]);
}

// Base class declaration: mavlink.message will be the parent class for each
// concrete implementation in mavlink.messages.
mavlink.message = function() {};

// Convenience setter to facilitate turning the unpacked array of data into member properties
mavlink.message.prototype.set = function(args) {
    _.each(this.fieldnames, function(e, i) {
        this[e] = args[i];
    }, this);
};

// This pack function builds the header and produces a complete MAVLink message,
// including header and message CRC.
mavlink.message.prototype.pack = function(crc_extra, payload) {

    this.payload = payload;
    this.header = new mavlink.header(this.id, payload.length, this.seq, this.srcSystem, this.srcComponent);    
    this.msgbuf = this.header.pack().concat(payload);
    var crc = mavutil.x25Crc(this.msgbuf.slice(1));

    // For now, assume always using crc_extra = True.  TODO: check/fix this.
    crc = mavutil.x25Crc([crc_extra], crc);
    this.msgbuf = this.msgbuf.concat(jspack.Pack('<H', [crc] ) );
    return this.msgbuf;

}


// enums

// MAV_AUTOPILOT
mavlink.MAV_AUTOPILOT_GENERIC = 0 // Generic autopilot, full support for everything
mavlink.MAV_AUTOPILOT_PIXHAWK = 1 // PIXHAWK autopilot, http://pixhawk.ethz.ch
mavlink.MAV_AUTOPILOT_SLUGS = 2 // SLUGS autopilot, http://slugsuav.soe.ucsc.edu
mavlink.MAV_AUTOPILOT_ARDUPILOTMEGA = 3 // ArduPilotMega / ArduCopter, http://diydrones.com
mavlink.MAV_AUTOPILOT_OPENPILOT = 4 // OpenPilot, http://openpilot.org
mavlink.MAV_AUTOPILOT_GENERIC_WAYPOINTS_ONLY = 5 // Generic autopilot only supporting simple waypoints
mavlink.MAV_AUTOPILOT_GENERIC_WAYPOINTS_AND_SIMPLE_NAVIGATION_ONLY = 6 // Generic autopilot supporting waypoints and other simple navigation
                        // commands
mavlink.MAV_AUTOPILOT_GENERIC_MISSION_FULL = 7 // Generic autopilot supporting the full mission command set
mavlink.MAV_AUTOPILOT_INVALID = 8 // No valid autopilot, e.g. a GCS or other MAVLink component
mavlink.MAV_AUTOPILOT_PPZ = 9 // PPZ UAV - http://nongnu.org/paparazzi
mavlink.MAV_AUTOPILOT_UDB = 10 // UAV Dev Board
mavlink.MAV_AUTOPILOT_FP = 11 // FlexiPilot
mavlink.MAV_AUTOPILOT_ENUM_END = 12 // 

// MAV_TYPE
mavlink.MAV_TYPE_GENERIC = 0 // Generic micro air vehicle.
mavlink.MAV_TYPE_FIXED_WING = 1 // Fixed wing aircraft.
mavlink.MAV_TYPE_QUADROTOR = 2 // Quadrotor
mavlink.MAV_TYPE_COAXIAL = 3 // Coaxial helicopter
mavlink.MAV_TYPE_HELICOPTER = 4 // Normal helicopter with tail rotor.
mavlink.MAV_TYPE_ANTENNA_TRACKER = 5 // Ground installation
mavlink.MAV_TYPE_GCS = 6 // Operator control unit / ground control station
mavlink.MAV_TYPE_AIRSHIP = 7 // Airship, controlled
mavlink.MAV_TYPE_FREE_BALLOON = 8 // Free balloon, uncontrolled
mavlink.MAV_TYPE_ROCKET = 9 // Rocket
mavlink.MAV_TYPE_GROUND_ROVER = 10 // Ground rover
mavlink.MAV_TYPE_SURFACE_BOAT = 11 // Surface vessel, boat, ship
mavlink.MAV_TYPE_SUBMARINE = 12 // Submarine
mavlink.MAV_TYPE_HEXAROTOR = 13 // Hexarotor
mavlink.MAV_TYPE_OCTOROTOR = 14 // Octorotor
mavlink.MAV_TYPE_TRICOPTER = 15 // Octorotor
mavlink.MAV_TYPE_FLAPPING_WING = 16 // Flapping wing
mavlink.MAV_TYPE_ENUM_END = 17 // 

// MAV_MODE_FLAG
mavlink.MAV_MODE_FLAG_CUSTOM_MODE_ENABLED = 1 // 0b00000001 Reserved for future use.
mavlink.MAV_MODE_FLAG_TEST_ENABLED = 2 // 0b00000010 system has a test mode enabled. This flag is intended for
                        // temporary system tests and should not be
                        // used for stable implementations.
mavlink.MAV_MODE_FLAG_AUTO_ENABLED = 4 // 0b00000100 autonomous mode enabled, system finds its own goal
                        // positions. Guided flag can be set or not,
                        // depends on the actual implementation.
mavlink.MAV_MODE_FLAG_GUIDED_ENABLED = 8 // 0b00001000 guided mode enabled, system flies MISSIONs / mission items.
mavlink.MAV_MODE_FLAG_STABILIZE_ENABLED = 16 // 0b00010000 system stabilizes electronically its attitude (and
                        // optionally position). It needs however
                        // further control inputs to move around.
mavlink.MAV_MODE_FLAG_HIL_ENABLED = 32 // 0b00100000 hardware in the loop simulation. All motors / actuators are
                        // blocked, but internal software is full
                        // operational.
mavlink.MAV_MODE_FLAG_MANUAL_INPUT_ENABLED = 64 // 0b01000000 remote control input is enabled.
mavlink.MAV_MODE_FLAG_SAFETY_ARMED = 128 // 0b10000000 MAV safety set to armed. Motors are enabled / running / can
                        // start. Ready to fly.
mavlink.MAV_MODE_FLAG_ENUM_END = 129 // 

// MAV_MODE_FLAG_DECODE_POSITION
mavlink.MAV_MODE_FLAG_DECODE_POSITION_CUSTOM_MODE = 1 // Eighth bit: 00000001
mavlink.MAV_MODE_FLAG_DECODE_POSITION_TEST = 2 // Seventh bit: 00000010
mavlink.MAV_MODE_FLAG_DECODE_POSITION_AUTO = 4 // Sixt bit:   00000100
mavlink.MAV_MODE_FLAG_DECODE_POSITION_GUIDED = 8 // Fifth bit:  00001000
mavlink.MAV_MODE_FLAG_DECODE_POSITION_STABILIZE = 16 // Fourth bit: 00010000
mavlink.MAV_MODE_FLAG_DECODE_POSITION_HIL = 32 // Third bit:  00100000
mavlink.MAV_MODE_FLAG_DECODE_POSITION_MANUAL = 64 // Second bit: 01000000
mavlink.MAV_MODE_FLAG_DECODE_POSITION_SAFETY = 128 // First bit:  10000000
mavlink.MAV_MODE_FLAG_DECODE_POSITION_ENUM_END = 129 // 

// MAV_STATE
mavlink.MAV_STATE_UNINIT = 0 // Uninitialized system, state is unknown.
mavlink.MAV_STATE_BOOT = 1 // System is booting up.
mavlink.MAV_STATE_CALIBRATING = 2 // System is calibrating and not flight-ready.
mavlink.MAV_STATE_STANDBY = 3 // System is grounded and on standby. It can be launched any time.
mavlink.MAV_STATE_ACTIVE = 4 // System is active and might be already airborne. Motors are engaged.
mavlink.MAV_STATE_CRITICAL = 5 // System is in a non-normal flight mode. It can however still navigate.
mavlink.MAV_STATE_EMERGENCY = 6 // System is in a non-normal flight mode. It lost control over parts or
                        // over the whole airframe. It is in mayday
                        // and going down.
mavlink.MAV_STATE_POWEROFF = 7 // System just initialized its power-down sequence, will shut down now.
mavlink.MAV_STATE_ENUM_END = 8 // 

// message IDs
mavlink.MAVLINK_MSG_ID_BAD_DATA = -1
mavlink.MAVLINK_MSG_ID_HEARTBEAT = 0

mavlink.messages = {};

/* 
The heartbeat message shows that a system is present and responding.
The type of the MAV and Autopilot hardware allow the receiving system
to treat further messages from this system appropriate (e.g. by laying
out the user interface based on the autopilot).

                type                      : Type of the MAV (quadrotor, helicopter, etc., up to 15 types, defined in MAV_TYPE ENUM) (uint8_t)
                autopilot                 : Autopilot type / class. defined in MAV_AUTOPILOT ENUM (uint8_t)
                base_mode                 : System mode bitfield, see MAV_MODE_FLAGS ENUM in mavlink/include/mavlink_types.h (uint8_t)
                custom_mode               : A bitfield for use for autopilot-specific flags. (uint32_t)
                system_status             : System status flag, see MAV_STATE ENUM (uint8_t)
                mavlink_version           : MAVLink version (uint8_t)

*/
mavlink.messages.heartbeat = function(type, autopilot, base_mode, custom_mode, system_status, mavlink_version) {

    this.format = '<IBBBBB';
    this.id = mavlink.MAVLINK_MSG_ID_HEARTBEAT;
    this.order_map = [1, 2, 3, 0, 4, 5];
    this.crc_extra = 50;
    this.name = 'HEARTBEAT';

    this.fieldnames = ['type', 'autopilot', 'base_mode', 'custom_mode', 'system_status', 'mavlink_version'];


    this.set(arguments);

}
        
mavlink.messages.heartbeat.prototype = new mavlink.message;

mavlink.messages.heartbeat.prototype.pack = function() {
    return mavlink.message.prototype.pack.call(this, this.crc_extra, jspack.Pack(this.format, [ this.custom_mode, this.type, this.autopilot, this.base_mode, this.system_status, this.mavlink_version]));
}



mavlink.map = {
        0: { format: '<IBBBBB', type: mavlink.messages.heartbeat, order_map: [1, 2, 3, 0, 4, 5], crc_extra: 50 },
}


// Special mavlink message to capture malformed data packets for debugging
mavlink.messages.bad_data = function(data, reason) {
    this.id = mavlink.MAVLINK_MSG_ID_BAD_DATA;
    this.data = data;
    this.reason = reason;
}

/* MAVLink protocol handling class */
MAVLink = function(logger, srcSystem, srcComponent) {

    this.logger = logger;

    this.seq = 0;
    this.buf = new Buffer(0);
   
    this.srcSystem = (typeof srcSystem === 'undefined') ? 0 : srcSystem;
    this.srcComponent =  (typeof srcComponent === 'undefined') ? 0 : srcComponent;

    // The first packet we expect is a valid header, 6 bytes.
    this.expected_length = 6;

    this.have_prefix_error = false;

    this.protocol_marker = 254;
    this.little_endian = true;

    this.crc_extra = true;
    this.sort_fields = true;
    this.total_packets_sent = 0;
    this.total_bytes_sent = 0;
    this.total_packets_received = 0;
    this.total_bytes_received = 0;
    this.total_receive_errors = 0;
    this.startup_time = Date.now();
    
}

// Implements EventEmitter
util.inherits(MAVLink, events.EventEmitter);

// If the logger exists, this function will add a message to it.
// Assumes the logger is a winston object.
MAVLink.prototype.log = function(message) {
    if(this.logger) {
        this.logger.info(message);
    }
}

MAVLink.prototype.send = function(mavmsg) {
        buf = mavmsg.pack(this);
        this.file.write(buf);
        this.seq = (this.seq + 1) % 255;
        this.total_packets_sent +=1;
        this.total_bytes_sent += buf.length;
}

// return number of bytes needed for next parsing stage
MAVLink.prototype.bytes_needed = function() {
    ret = this.expected_length - this.buf.length;
    return ( ret <= 0 ) ? 1 : ret;
}

// add data to the local buffer
MAVLink.prototype.pushBuffer = function(data) {
    if(data) {
        this.buf = Buffer.concat([this.buf, data]);
        this.total_bytes_received += data.length;
    }
}

// Decode prefix.  Elides the prefix.
MAVLink.prototype.parsePrefix = function() {

    // Test for a message prefix.
    if( this.buf.length >= 1 && this.buf[0] != 254 ) {

        // Strip the offending initial byte and throw an error.
        var badPrefix = this.buf[0];
        this.buf = this.buf.slice(1);
        this.expected_length = 6;
        this.total_receive_errors +=1;
        throw new Error("Bad prefix ("+badPrefix+")");

    }

}

// Determine the length.  Leaves buffer untouched.
MAVLink.prototype.parseLength = function() {
    
    if( this.buf.length >= 3 ) {
        var unpacked = jspack.Unpack('BB', this.buf.slice(1, 3));
        this.expected_length = unpacked[0] + 8; // length of message + header + CRC
    }

}

// input some data bytes, possibly returning a new message
MAVLink.prototype.parseChar = function(c) {

    var m;
    try {

        this.pushBuffer(c);
        this.parsePrefix();
        this.parseLength();
        m = this.parsePayload();

    } catch(e) {

       // w.info("Got a bad data message ("+e.message+")");
        this.total_receive_errors += 1;
        m = new mavlink.messages.bad_data(this.buf, e.message);
        
    }

    return m;

}

MAVLink.prototype.parsePayload = function() {

    // If we have enough bytes to try and read it, read it.
    if( this.expected_length >= 8 && this.buf.length >= this.expected_length ) {

        // Slice off the expected packet length, reset expectation to be to find a header.
        var mbuf = this.buf.slice(0, this.expected_length);

        // w.info("Attempting to parse packet, message candidate buffer is ["+mbuf.toByteArray()+"]");

        try {

            var m = this.decode(mbuf);
            this.total_packets_received += 1;
            this.buf = this.buf.slice(this.expected_length);
            this.expected_length = 6;
            this.emit(m.name, m);
            this.emit('message', m);
            return m;

        } catch(e) {

            // In this case, we thought we'd have a valid packet, but
            // didn't.  It could be that the packet was structurally present
            // but malformed, or, it could be that random line noise
            // made this look like a packet.  Consume the first symbol in the buffer and continue parsing.
            this.buf = this.buf.slice(1);
            this.expected_length = 6;
            
            // Log.
            //w.info(e);

            // bubble
            throw e;
        }
    }
    return null;

}

// input some data bytes, possibly returning an array of new messages
MAVLink.prototype.parseBuffer = function(s) {
    
    // Get a message, if one is available in the stream.
    var m = this.parseChar(s);

    // No messages available, bail.
    if ( null === m ) {
        return null;
    }
    
    // While more valid messages can be read from the existing buffer, add
    // them to the array of new messages and return them.
    var ret = [m];
    while(true) {
        m = this.parseChar();
        if ( null === m ) {
            // No more messages left.
            return ret;
        }
        ret.push(m);
    }
    return ret;

}

/* decode a buffer as a MAVLink message */
MAVLink.prototype.decode = function(msgbuf) {

    var magic, mlen, seq, srcSystem, srcComponent, unpacked, msgId;

    // decode the header
    try {
        unpacked = jspack.Unpack('cBBBBB', msgbuf.slice(0, 6));
        magic = unpacked[0];
        mlen = unpacked[1];
        seq = unpacked[2];
        srcSystem = unpacked[3];
        srcComponent = unpacked[4];
        msgId = unpacked[5];
    }
    catch(e) {
        throw new Error('Unable to unpack MAVLink header: ' + e.message);
    }

    if (magic.charCodeAt(0) != 254) {
        throw new Error("Invalid MAVLink prefix ("+magic.charCodeAt(0)+")");
    }

    if( mlen != msgbuf.length - 8 ) {
        throw new Error("Invalid MAVLink message length.  Got " + (msgbuf.length - 8) + " expected " + mlen + ", msgId=" + msgId);
    }

    if( false === _.has(mavlink.map, msgId) ) {
        throw new Error("Unknown MAVLink message ID (" + msgId + ")");
    }

    // decode the payload
    // refs: (fmt, type, order_map, crc_extra) = mavlink.map[msgId]
    var decoder = mavlink.map[msgId];

    // decode the checksum
    try {
        var receivedChecksum = jspack.Unpack('<H', msgbuf.slice(msgbuf.length - 2));
    } catch (e) {
        throw new Error("Unable to unpack MAVLink CRC: " + e.message);
    }

    var messageChecksum = mavutil.x25Crc(msgbuf.slice(1, msgbuf.length - 2));

    // Assuming using crc_extra = True.  See the message.prototype.pack() function.
    messageChecksum = mavutil.x25Crc([decoder.crc_extra], messageChecksum);
    
    if ( receivedChecksum != messageChecksum ) {
        throw new Error('invalid MAVLink CRC in msgID ' +msgId+ ', got 0x' + receivedChecksum + ' checksum, calculated payload checkum as 0x'+messageChecksum );
    }

    // Decode the payload and reorder the fields to match the order map.
    try {
        var t = jspack.Unpack(decoder.format, msgbuf.slice(6, msgbuf.length));
    }
    catch (e) {
        throw new Error('Unable to unpack MAVLink payload type='+decoder.type+' format='+decoder.format+' payloadLength='+ msgbuf.slice(6, -2).length +': '+ e.message);
    }

    // Reorder the fields to match the order map
    var args = [];
    _.each(t, function(e, i, l) {
        args[i] = t[decoder.order_map[i]]
    });

    // construct the message object
    try {
        var m = new decoder.type(args);
        m.set.call(m, args);
    }
    catch (e) {
        throw new Error('Unable to instantiate MAVLink message of type '+decoder.type+' : ' + e.message);
    }
    m.msgbuf = msgbuf;
    m.payload = msgbuf.slice(6);
    m.crc = receivedChecksum;
    m.header = new mavlink.header(msgId, mlen, seq, srcSystem, srcComponent);
    this.log(m);
    return m;
}

// Expose this code as a module
module.exports = mavlink;

