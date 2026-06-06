const express =
  require("express");

const router =
  express.Router();

const {
  createTeam,
  getTeamList,
} = require(
  "../controllers/teamController"
);

router.post(
  "/create",
  createTeam
);

router.get(
  "/list",
  getTeamList
);

module.exports =
  router;