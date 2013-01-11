videre-server.js
================

Node.js based server for Videre

all module dependancies are hidden from git via .gitignore. Install manually from the project root directory.

Module Dependancies are:
 - websocket - https://npmjs.org/package/websocket (use npm install websocket to install)
 - node-uuid - https://npmjs.org/package/node-uuid (use npm install node-uuid to install)
 - node-bcrypt - https://npmjs.org/package/bcrypt (use npm install bcrypt to install)

Submodules
-------------
The submodule videre-common is located within this project. When cloning this project the directory for videre-common will exist but it will not have any files. To get the submodule perform the following:

```
git submodule init
git submodule update
```

Refer to http://git-scm.com/book/en/Git-Tools-Submodules#Starting-with-Submodules for further information.

HTTPS Requirements
------------

To support HTTPS (which is required), the files privatekey.pem and certificate.pem will be required in the subdirectory `./keys/`. To create the files execute the following commands:

```
openssl genrsa -out privatekey.pem 1024 
openssl req -new -key privatekey.pem -out certrequest.csr 
openssl x509 -req -in certrequest.csr -signkey privatekey.pem -out certificate.pem
openssl pkcs12 -export -in certificate.pem -inkey privatekey.pem -out certificate.p12
```

License
---------
Copyright(c) 2012 James Jenner james.g.jenner@gmail.com
