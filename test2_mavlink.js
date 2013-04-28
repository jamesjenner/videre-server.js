
var VehicleDriverRegister   = require('./vehicle/register.js');
var vehicleDriverRegister = new VehicleDriverRegister();

remoteVehicle = null;

var ParrotPx4Driver = vehicleDriverRegister.getDriver(VehicleRegister.DEVICE_PARROT_PX4);
var RoverPx4Driver = vehicleDriverRegister.getDriver(VehicleRegister.DEVICE_PX4_ROVER_V1);

if(!ParrotPx4Driver) {
    console.log((new Date()) + ' vehicle device ' + VehicleDriverRegister.DEVICE_PARROT_PX4 + ' not supported');
} 
if(!RoverPx4Driver) {
    console.log((new Date()) + ' vehicle device ' + VehicleDriverRegister.DEVICE_PX4_ROVER_V1 + ' not supported');
} 

remoteVehicle = new RoverPx4Driver({
    name: 'Test',
    id: '1111',
    address: '/dev/ttyUSB0',
    debug: true,
    debugLevel: 3
});

if(remoteVehicle) {
    remoteVehicle.on('telemetry', function(d) { 
	console.log((new Date()) + ' process telemetry: ' + JSON.stringify(d));
    });
    remoteVehicle.on('activeState', function(d) {
	console.log((new Date()) + ' process active state: ' + d);
    });
    remoteVehicle.on('connectionState', function(d) {
	console.log((new Date()) + ' process connection state: ' + d);
    });
    remoteVehicle.on('payload', function(d) {
	console.log((new Date()) + ' process payload: ' + JSON.stringify(d));
    });

    // TODO: what happens if we lose coms? what performs the auto re-connect?
    if(config.debug) {
	console.log((new Date()) + " startVehicleComms: connecting... ");
    }

    remoteVehicle.connect();
}
