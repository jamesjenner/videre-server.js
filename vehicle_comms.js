/*
 * videre_comms.js v0.1 alpha
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

var net = require('net');

// TCP logic...
var sockets = [];

var s = net.Server(function(socket) {
    sockets.push(socket);

    socket.on('data', function(d) { 
	for (var i = 0; i < sockets.length; i++) { 
	    if(sockets[i] === socket) 
		continue;
	    sockets[i].write(d);
	} 
    });

    socket.on('end', function() { 
	// remove the closing socket from the array
	var i = sockets.indexOf(socket);
	sockets.splice(i, 1);
    });
});

s.listen(8000);
