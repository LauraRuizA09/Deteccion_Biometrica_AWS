// URL base de tu API Gateway (stage /dev incluido)
const API_BASE = "https://r3s2i2pyf7.execute-api.us-east-1.amazonaws.com/dev";

document.addEventListener("DOMContentLoaded", () => {
  const apiBaseDisplay = document.getElementById("apiBaseDisplay");
  apiBaseDisplay.textContent = API_BASE;

  const employeeForm = document.getElementById("employeeForm");
  const employeeStatus = document.getElementById("employeeStatus");

  const accessForm = document.getElementById("accessForm");
  const accessStatus = document.getElementById("accessStatus");

  const loadEventsBtn = document.getElementById("loadEventsBtn");
  const eventsStatus = document.getElementById("eventsStatus");
  const eventsTbody = document.getElementById("eventsTbody");

  // ----------- Alta de empleados -----------
  employeeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    employeeStatus.textContent = "Subiendo imagen y registrando empleado...";

    try {
      const employeeId = document.getElementById("employeeId").value.trim();
      const employeeName = document.getElementById("employeeName").value.trim();
      const employeeDept = document.getElementById("employeeDept").value.trim();
      const employeePhoto = document.getElementById("employeePhoto").files[0];

      if (!employeeId || !employeeName || !employeeDept || !employeePhoto) {
        employeeStatus.textContent = "Faltan datos o la foto.";
        return;
      }

      const b64 = await fileToBase64(employeePhoto);
      const payload = {
        employee_id: employeeId,
        name: employeeName,
        department: employeeDept,
        images: [b64]
      };

      const res = await fetch(API_BASE + "/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const { raw, data } = await parseApiJson(res);

      if (!res.ok) {
        employeeStatus.textContent = `Error: ${JSON.stringify(data)}`;
        return;
      }

      console.log("Respuesta /employees:", raw, "payload:", data);

      const emp = data.employee || {};
      employeeStatus.textContent =
        `Empleado registrado:\n` +
        `ID: ${emp.employee_id}\n` +
        `Nombre: ${emp.name}\n` +
        `Departamento: ${emp.department}`;
    } catch (err) {
      console.error(err);
      employeeStatus.textContent = `Error inesperado: ${err}`;
    }
  });

  // ----------- Probar acceso -----------
  accessForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    accessStatus.textContent = "Enviando imagen para verificación...";

    try {
      const doorId = document.getElementById("doorId").value.trim() || "main-door";
      const accessPhoto = document.getElementById("accessPhoto").files[0];

      if (!accessPhoto) {
        accessStatus.textContent = "Debes seleccionar una foto.";
        return;
      }

      const b64 = await fileToBase64(accessPhoto);
      const payload = {
        door_id: doorId,
        image: b64
      };

      const res = await fetch(API_BASE + "/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const { raw, data } = await parseApiJson(res);

      if (!res.ok) {
        accessStatus.textContent = `Error: ${JSON.stringify(data)}`;
        return;
      }

      console.log("Respuesta /access:", raw, "payload:", data);

      const status = data.status;
      const employee = data.employee;

      let msg = `Estado: ${status}\n`;
      if (employee) {
        msg += `Empleado: ${employee.name} (${employee.employee_id})\n`;
        msg += `Departamento: ${employee.department}\n`;
      } else {
        msg += `Empleado: desconocido\n`;
      }

      if (data.match && typeof data.match.similarity !== "undefined") {
        msg += `Similarity: ${Number(data.match.similarity).toFixed(2)}%`;
      }

      accessStatus.textContent = msg;
    } catch (err) {
      console.error(err);
      accessStatus.textContent = `Error inesperado: ${err}`;
    }
  });

  // ----------- Cargar eventos -----------
  loadEventsBtn.addEventListener("click", async () => {
    eventsStatus.textContent = "Cargando eventos...";
    eventsTbody.innerHTML = "";

    try {
      const res = await fetch(API_BASE + "/events?limit=50", {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });

      const { raw, data } = await parseApiJson(res);

      if (!res.ok) {
        eventsStatus.textContent = `Error: ${JSON.stringify(data)}`;
        return;
      }

      console.log("Respuesta /events:", raw, "payload:", data);

      const events = data.events || [];
      eventsStatus.textContent = `Total eventos mostrados: ${events.length}`;

      if (events.length === 0) {
        eventsTbody.innerHTML = "<tr><td colspan='5'>Sin eventos</td></tr>";
        return;
      }

      for (const ev of events) {
        const tr = document.createElement("tr");

        const tdTime = document.createElement("td");
        tdTime.textContent = ev.timestamp || "";

        const tdEmp = document.createElement("td");
        tdEmp.textContent = ev.employee_id || "Desconocido";

        const tdDoor = document.createElement("td");
        tdDoor.textContent = ev.door_id || "";

        const tdStatus = document.createElement("td");
        const span = document.createElement("span");
        span.textContent = ev.status || "";
        span.classList.add("pill");
        const s = (ev.status || "").toUpperCase();
        if (s === "GRANTED") span.classList.add("pill-granted");
        else if (s === "DENIED") span.classList.add("pill-denied");
        else span.classList.add("pill-unknown");
        tdStatus.appendChild(span);

        const tdSim = document.createElement("td");
        if (typeof ev.similarity !== "undefined") {
          tdSim.textContent = Number(ev.similarity).toFixed(2) + " %";
        } else {
          tdSim.textContent = "";
        }

        tr.appendChild(tdTime);
        tr.appendChild(tdEmp);
        tr.appendChild(tdDoor);
        tr.appendChild(tdStatus);
        tr.appendChild(tdSim);

        eventsTbody.appendChild(tr);
      }
    } catch (err) {
      console.error(err);
      eventsStatus.textContent = `Error inesperado: ${err}`;
    }
  });
});

// ----------- Helpers -----------

// Convierte un File (input type="file") en un string base64 sin el prefijo data:image/...
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      // result tiene formato "data:image/jpeg;base64,AAAA..."
      const base64 = result.toString().split(",")[1];
      resolve(base64);
    };
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

// Desempaqueta respuestas de API Gateway proxy o no-proxy.
// Devuelve { raw, data }, donde data es el payload "real".
async function parseApiJson(res) {
  const raw = await res.json(); // lo que vea fetch

  let data = raw;
  if (raw && Object.prototype.hasOwnProperty.call(raw, "body")) {
    if (typeof raw.body === "string") {
      try {
        data = JSON.parse(raw.body);
      } catch (e) {
        console.error("No se pudo parsear raw.body:", e, raw.body);
      }
    } else if (typeof raw.body === "object" && raw.body !== null) {
      data = raw.body;
    }
  }

  return { raw, data };
}

