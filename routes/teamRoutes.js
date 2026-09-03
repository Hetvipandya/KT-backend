const express =
  require("express");

const router =
  express.Router();

const {
  createTeam,
  assignTeam,
  getTeamList,
  updateTeam,
  removeTeam,
} = require(
  "../controllers/teamController"
);

// CREATE TEAM
router.post(
  "/create",
  createTeam
);

// ASSIGN TEAM
router.post(
  "/assign",
  assignTeam
);

// TEAM LIST
router.get(
  "/list",
  getTeamList
);

// UPDATE TEAM
router.put(
  "/update/:id",
  updateTeam
);

// REMOVE TEAM
router.delete(
  "/remove/:id",
  removeTeam
);

module.exports =
  router;