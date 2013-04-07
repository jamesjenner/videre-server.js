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

-d, --debug             Generate debugging messages, level is optional. 0 - informational, 1 - detailed (includes telemetry)

-va, --add-vehicles     Allow clients to add vehicles

-vd, --delete-vehicles  Allow clients to delete vehicles

-vu, --update-vehicles  Allow clients to update vehicles

-u, --update-vehicles   Allow clients to update vehicles

-so, --secure-only      Set communications to only accept secure connections

-m, --mixed             Set communications to accept secure and unsecure connections

-u1, --uuid-v1          Set uuid generation for session keys to uuid v1, default is v4

-p, --port              Set the port parameter

-s, --ssl-port          Set the ssl port parameter

-sk, --ssl-key          Set the ssl private key file parameter

-sc, --ssl-cert         Set the ssl certificate parameter

-g, --generate          Generate a configuration file

-h, --help              This help document.


Dependancies
------------
All module dependancies are hidden from git via .gitignore. Install manually from the project root directory.

Module Dependancies are:
 - websocket - https://npmjs.org/package/websocket
 - node-uuid - https://npmjs.org/package/node-uuid
 - node-bcrypt - https://npmjs.org/package/bcrypt
 - opt - https://npmjs.org/package/opt or https://github.com/rsdoiel/opt
 - ar-drone - https://npmjs.org/package/ar-drone or https://github.com/felixge/node-ar-drone
 - serialport - https://npmjs.org/package/serialport
 - underscore - https://npmjs.org/package/underscore

To install the modules use the following commands:

```
npm install websocket
npm install node-uuid
npm install bcrypt
npm install opt
npm install ar-drone
npm install serialport
npm install underscore
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
