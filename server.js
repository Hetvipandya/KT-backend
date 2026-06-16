const dotenv =
  require("dotenv");
dotenv.config();

const express =
  require("express");

const mongoose =
  require("mongoose");

const cors =
  require("cors");

const path =
  require("path");

const fs =
  require("fs");

const app =
  express();

// ================= AUTO CREATE UPLOAD FOLDER =================
const uploadPath =
  path.join(
    __dirname,
    "uploads",
    "employees"
  );

if (
  !fs.existsSync(uploadPath)
) {
  fs.mkdirSync(
    uploadPath,
    {
      recursive: true,
    }
  );
}

// ================= MIDDLEWARE =================

// CORS
app.use(cors());

// JSON parser
app.use(
  express.json({
    limit: "50mb",
  })
);

// URL encoded parser
app.use(
  express.urlencoded({
    extended: true,
    limit: "50mb",
  })
);

// ================= STATIC FILES =================
app.use(
  "/uploads",
  express.static(
    path.join(
      __dirname,
      "uploads"
    )
  )
);

// ================= ROUTES =================

const userRoutes =
  require(
    "./routes/userRoutes"
  );

const roleRoutes =
  require(
    "./routes/roleRoutes"
  );

const companyRoutes =
  require(
    "./routes/companyRoutes"
  );

const departmentRoutes =
  require(
    "./routes/departmentRoutes"
  );

const teamRoutes =
  require(
    "./routes/teamRoutes"
  );

const employeeRoutes =
  require(
    "./routes/employeeRoutes"
  );

const studentRoutes =
require(
  "./routes/studentRoutes"
)  

const recruitmentRoutes=
require(
  "./routes/recruitmentRoutes"
)

const interviewRoundRoutes=
require(
  "./routes/interviewRoundRoutes"
)

const attendanceRoutes=
require(
  "./routes/attendanceRoutes"
)

const leaveRoutes=
require(
  "./routes/leaveRoutes"
)

const projectRoutes =
require(
  "./routes/projectRoutes"
)

const taskManagementRoutes =
require(
  "./routes/taskManagementRoutes"
)

const crmRoutes =
require(
  "./routes/crmRoutes"
)

const payrollRoutes =
require(
  "./routes/payrollRoutes"
)

const expenseRoutes =
require(
  "./routes/expenseRoutes"
)

const documentRoutes =
require(
  "./routes/documentRoutes"
)

const notificationRoutes =
require(
  "./routes/notificationRoutes"
)

const projectManagementRoutes =
 require(
  "./routes/projectManagementRoutes"
 )

 const dailyReportRoutes =
 require(
  "./routes/dailyReportRoutes"
 )

 const teamLeadRoutes =
 require(
  "./routes/teamLeadRoutes"
 )

 const projectFollowUpRoutes =
 require(
  "./routes/projectFollowUpRoutes"
 )

 const projectAnalyticsRoutes =
 require(
  "./routes/projectMonitoringRoutes"
 )
// ================= API PREFIX =================

app.use(
  "/api/users",
  userRoutes
);

app.use(
  "/api/role",
  roleRoutes
);

app.use(
  "/api/company",
  companyRoutes
);

app.use(
  "/api/department",
  departmentRoutes
);

app.use(
  "/api/team",
  teamRoutes
);

app.use(
  "/api/employee",
  employeeRoutes
);

app.use(
  "/api/student",
  studentRoutes
)

app.use(
  "/api/recruitment",
  recruitmentRoutes
)

app.use(
  "/api/interviewRound",
  interviewRoundRoutes
)

app.use(
  "/api/attendance",
  attendanceRoutes
)

app.use(
  "/api/leave",
  leaveRoutes
)

app.use(
  "/api/projectManage",
  projectRoutes
)

app.use(
  "/api/task",
  taskManagementRoutes
)

app.use(
  "/api/crm",
  crmRoutes
)

app.use(
  "/api/payroll",
  payrollRoutes
)

app.use(
  "/api/expense",
  expenseRoutes
)

app.use(
  "/api/document",
  documentRoutes
)

app.use(
  "/api/notification",
  notificationRoutes
)

app.use(
  "/api/project",
  projectManagementRoutes
)

app.use(
  "/api/dailyUpdate",
  dailyReportRoutes
)

app.use(
  "/api/teamLead",
  teamLeadRoutes
)

app.use(
  "/api/followup",
  projectFollowUpRoutes
)

app.use(
  "/api/projectAnalytics",
  projectAnalyticsRoutes
)
// ================= HEALTH CHECK =================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message:
      "🚀 Node Express Server Running Successfully",
  });
});

// ================= DATABASE CONNECTION =================

mongoose
  .connect(
    process.env.MONGODB_URI
  )
  .then(() => {
    console.log(
      "✅ MongoDB Connected"
    );

    const PORT =
      process.env.PORT ||
      5000;

    app.listen(PORT, () => {
      console.log(
        `🚀 Server Running on Port ${PORT}`
      );
    });
  })
  .catch((err) => {
    console.log(
      "❌ MongoDB Connection Error:",
      err.message
    );
  });

// ================= GLOBAL ERROR HANDLER =================

app.use(
  (err, req, res, next) => {
    console.error(err.stack);

    res.status(500).json({
      success: false,
      message:
        "Internal Server Error",
      error: err.message,
    });
  }
);