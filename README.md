videre-server.js
================

Node.js based server for Videre

all module dependancies are hidden from git via .gitignore. Install manually from the project root directory.

Module Dependancies are:
 - websocket - https://npmjs.org/package/websocket (use npm install websocket to install)

The submodule videre-common is located within this project. When cloning this project the directory for videre-common will exist but it will not have any files. To get the submodule perform the following:

 git submodule init
 git submodule update

Refer to http://git-scm.com/book/en/Git-Tools-Submodules#Starting-with-Submodules for further information.
