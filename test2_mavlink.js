
var VehicleDriverRegister   = require('./vehicle/register.js');
var vehicleDriverRegister = new VehicleDriverRegister();


Driver  = vehicleDriverRegister.getDriver("parrot.px4.mavlink");

var driver1 = new Driver({
    name: 'Minion I',
    id: '873c7e71-5ba4-46ec-85c6-117045c4da11',
    debug: true,
    debugLevel: 3,
    connectionType: 'Serial',
    serialPort: '/dev/ttyUSB0',
    serialBaud: '57600',
    positionReportingMode: 'Distance',
    positionReportingValue: '2',
});

var driver2 = new Driver({
    name: 'Parrot 1',
    id: '27828946-bdda-4ede-adc6-6bbbeda3e53f',
    debug: true,
    debugLevel: 3,
    connectionType: 'Serial',
    serialPort: '/dev/ttyUSB1',
    serialBaud: '57600',
    positionReportingMode: 'Distance',
    positionReportingValue: '2',
});

var driver;
var vehicles = new Array();

/*
for(i = 0; i < 2; i++) {

    if(i === 0) {
        driver = driver1;
    } else {
	driver = driver2;
    }

    if (driver) {

	vehicles.push(driver);

	console.log("adding listeners on driver for " + driver.name);

	driver.on('telemetry', makeOnTelemetryFunction(driver, vehicles[i]));
	driver.on('activeState', makeOnActiveStateFunction(driver, vehicles[i]));
	driver.on('connectionState', makeOnConnectionStateFunction(driver, vehicles[i]));
	driver.on('payload', makeOnPayloadFunction(driver, vehicles[i]));
	driver.on('position', makeOnPositionFunction(driver, vehicles[i]));

	console.log("connecting to driver for " + vehicles[i].name);
	driver.connect();
    }
}
*/

vehicles.push(driver1);

console.log("adding listeners on driver for " + driver1.name);

var i = 0;
driver1.on('telemetry', makeOnTelemetryFunction(driver1, vehicles[i]));
driver1.on('activeState', makeOnActiveStateFunction(driver1, vehicles[i]));
driver1.on('connectionState', makeOnConnectionStateFunction(driver1, vehicles[i]));
driver1.on('payload', makeOnPayloadFunction(driver1, vehicles[i]));
driver1.on('position', makeOnPositionFunction(driver1, vehicles[i]));

console.log("connecting to driver for " + vehicles[i].name);
driver1.connect();

vehicles.push(driver2);

console.log("adding listeners on driver for " + driver2.name);

i = 1;
driver2.on('telemetry', makeOnTelemetryFunction(driver2, vehicles[i]));
driver2.on('activeState', makeOnActiveStateFunction(driver2, vehicles[i]));
driver2.on('connectionState', makeOnConnectionStateFunction(driver2, vehicles[i]));
driver2.on('payload', makeOnPayloadFunction(driver2, vehicles[i]));
driver2.on('position', makeOnPositionFunction(driver2, vehicles[i]));

console.log("connecting to driver for " + vehicles[i].name);
driver2.connect();

/*
 * enclosure for call to process position when a position event occurs
 */
function makeOnPositionFunction(remoteVehicle, vehicle) {
    return function(d) {
	console.log("processing position");
    };
}

/*
 * enclosure for call to process active state when an active state event occurs
 */
function makeOnActiveStateFunction(remoteVehicle, vehicle) {
    return function(d) {
	console.log("processing active state");
    };
}

/*
 * enclosure for call to process connection state when an connection state event occurs
 */
function makeOnConnectionStateFunction(remoteVehicle, vehicle) {
    return function(d) {
	console.log("processing connection state");
    };
}

/*
 * enclosure for call to process telemetry when a telemetry event occurs
 */
function makeOnTelemetryFunction(remoteVehicle, vehicle) {
    return function(d) {
	console.log("\tprocessing telemetry for " + remoteVehicle.name);
    };
}

/*
 * enclosure for call to process payload when a telemetry event occurs
 */
function makeOnPayloadFunction(remoteVehicle, vehicle) {
    return function(d) {
	console.log("processing payload");
    };
}
