import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readJson(relativePath) {
  const filePath = path.join(root, relativePath);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const jsonFiles = [
  "project.json",
  "devices/configuration.json",
  "devices/pin-mapping.json",
  "devices/servers/TankModbus.json",
  "node-red/tank-dashboard.json",
];

const parsed = new Map(jsonFiles.map((file) => [file, readJson(file)]));
const project = parsed.get("project.json");
const modbus = parsed.get("devices/servers/TankModbus.json");
const flow = parsed.get("node-red/tank-dashboard.json");

assert(Array.isArray(flow), "Node-RED export must be an array");

const nodesById = new Map();
for (const node of flow) {
  assert(typeof node.id === "string" && node.id.length > 0, "Every Node-RED node must have an ID");
  assert(!nodesById.has(node.id), `Duplicate Node-RED node ID: ${node.id}`);
  nodesById.set(node.id, node);
}

for (const node of flow) {
  for (const output of node.wires ?? []) {
    for (const targetId of output) {
      assert(nodesById.has(targetId), `${node.name || node.id} wires to missing node ${targetId}`);
    }
  }

  for (const field of ["z", "group", "page", "ui", "theme", "server"]) {
    const targetId = node[field];
    if (typeof targetId === "string" && targetId.length > 0) {
      assert(nodesById.has(targetId), `${node.name || node.id} has an invalid ${field} reference`);
    }
  }
}

function nodeNamed(name) {
  const node = flow.find((candidate) => candidate.name === name);
  assert(node, `Missing Node-RED node: ${name}`);
  return node;
}

const server = nodeNamed("OpenPLC Runtime (local)");
assert(server.tcpHost === "127.0.0.1", "Dashboard Modbus host must be local by default");
assert(Number(server.tcpPort) === modbus.modbusSlaveConfig.port, "Dashboard and PLC Modbus ports differ");
assert(!flow.some((node) => node.type === "debug" && node.active), "Export contains an active debug node");

const expectedReads = [
  ["Read Tank Data", "HoldingRegister", "0", "2"],
  ["Read Valve States", "Coil", "0", "2"],
  ["Read PLC High-Level Alarm", "Coil", "2", "1"],
  ["Read PLC Control States", "Coil", "8", "2"],
];

for (const [name, dataType, address, quantity] of expectedReads) {
  const node = nodeNamed(name);
  assert(node.dataType === dataType, `${name} uses the wrong Modbus data type`);
  assert(node.adr === address, `${name} uses the wrong Modbus address`);
  assert(node.quantity === quantity, `${name} reads the wrong quantity`);
  assert(node.unitid === "1", `${name} must use Modbus Unit ID 1`);
}

for (const [name, address] of [["Write AutoRun", 8], ["Write StopCmd", 9]]) {
  const node = nodeNamed(name);
  assert(node.func.includes(`address: ${address}`), `${name} writes to the wrong Modbus address`);
  assert(node.func.includes("unitid: 1"), `${name} must use Modbus Unit ID 1`);
}

const programPath = path.join(root, "pous/programs/main.st");
const program = fs.readFileSync(programPath, "utf8");
for (const address of ["%MX0.0", "%MX0.1", "%QX0.0", "%QX0.1", "%QX0.2", "%QW0", "%QW1"]) {
  assert(program.includes(address), `PLC program is missing mapped address ${address}`);
}

const instance = project.data?.configuration?.resource?.instances?.[0];
assert(instance?.program === "main", "OpenPLC project must schedule the main program");
assert(modbus.modbusSlaveConfig?.enabled === true, "Modbus TCP server must be enabled");

console.log(`Validated ${jsonFiles.length} JSON files and ${flow.length} Node-RED nodes.`);
