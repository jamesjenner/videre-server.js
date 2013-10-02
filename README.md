videre-server.js
================

Node.js based server for Videre. This server will act as the gateway between drones and clients.

The videre suite of software is designed to allow multi client access to drones via multiple servers. Refer to the videre project for the client.

Currently support only exists for AR Drone (tested on V1, should work on V2). Support for Navlink is currently in progress.

Usage
-----

USAGE:    node videre_server

SYNOPSIS: Videre server provides connecitvity between videre clients and drones.

OPTIONS:

-a, --analysis                Create logging for comms analysis

-d, --debug                   Generate debugging messages, level is optional. 0 - informational, 1 - detailed (includes telemetry)

-ca, --comms-add              Add a comms definition

-cd, --comms-delete           Delete a comms definition

-cl, --comms-list             List all defined comms

-pl, --protocl-list           List all defined protocols

-cad, --comms-auto-discover   Perform auto discovery of available comms (currently not implemented)

-cp, --comms-protocol         Comms protocol (mavlink.generic | ...)

-cc, --comms-connection-type  Comms connection type (Serial | Tcp)

-cna, --comms-network-address Comms network address

-cnp, --comms-network-port    Comms network port

-csp, --comms-serial-port     Comms serial port

-csb, --comms-serial-baud     Comms serial baud rate

-vu, --update-vehicles        Allow clients to update vehicles

-so, --secure-only            Set communications to only accept secure connections

-uo, --unsecure-only          Set communications to only accept unsecure connections (this is the default option)

-m, --mixed                   Set communications to accept secure and unsecure connections

-u1, --uuid-v1                Set uuid generation for session keys to uuid v1, default is v4

-p, --port                    Set the port parameter for remote connections

-s, --ssl-port                Set the ssl port parameter for remote secure connections

-sk, --ssl-key                Set the ssl private key file parameter for remote secure connections, if not found then will revert to unsecure communications

-sc, --ssl-cert               Set the ssl certificate parameter for remote secure connections, if not found then will revert to unsecure communications

-t, --telemetry-time          Set the timer for sending telemetry to clients, in milliseconds

-g, --generate                Generate a configuration file

-h, --help                    This help document.


Dependancies
------------
All module dependancies are hidden from git via .gitignore. Install manually from the project root directory.

Under ubuntu the default version of nodejs is quite old (as of 12.04LTE). This will result in a failure for the opt module as it has a dependency on the version of nodejs. Websocket will not run native with the older version of nodejs, while it will run natively with the latest version of nodejs. 

As such it is recommended to obtain nodejs from the nodejs website (requires compiling).

Under windows 64-bit systems there are problems compiling node-bcrypt. There are several threads about this issue on the github issues page for bcrypt.

Module Dependancies are:
 - websocket - https://npmjs.org/package/websocket
 - node-uuid - https://npmjs.org/package/node-uuid
 - node-bcrypt - https://npmjs.org/package/bcrypt
 - opt - https://npmjs.org/package/opt or https://github.com/rsdoiel/opt
 - ar-drone - https://npmjs.org/package/ar-drone or https://github.com/felixge/node-ar-drone
 - serialport - https://npmjs.org/package/serialport
 - underscore - https://npmjs.org/package/underscore
 - log4js - https://github.com/nomiddlename/log4js-node

To install the modules use the following command:

```
npm install
```

To install the modules individually use the following:

```
npm install websocket
npm install node-uuid
npm install bcrypt
npm install opt
npm install ar-drone
npm install serialport
npm install underscore
npm install log4js
```

Submodules
----------
The submodule videre-common is located within this project. When cloning this project the directory for videre-common will exist but it will not have any files. To get the submodule perform the following:

```
git submodule init
git submodule update
```

Refer to http://git-scm.com/book/en/Git-Tools-Submodules#Starting-with-Submodules for further information.

HTTPS Requirements
------------------

To support HTTPS (which is required), the files privatekey.pem and certificate.pem will be required in the subdirectory `./keys/`. To create the files execute the following commands:

```
openssl genrsa -out privatekey.pem 1024 
openssl req -new -key privatekey.pem -out certrequest.csr 
openssl x509 -req -in certrequest.csr -signkey privatekey.pem -out certificate.pem
openssl pkcs12 -export -in certificate.pem -inkey privatekey.pem -out certificate.p12
```

When the certificate is setup, the easiest way to make it available for a client is to browse to the name of the https://host:<secure port>, this will cause the browser to confirm that you wish to use the certificate.

License
-------
Copyright(c) 2012 James Jenner james.g.jenner@gmail.com, licensed under the terms of GPL V3
