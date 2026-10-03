const getOverallGrade = (kpiScore) => {
  if (kpiScore >= 85) return 'A';
  if (kpiScore >= 75) return 'B';
  if (kpiScore >= 65) return 'C';
  if (kpiScore >= 55) return 'D';
  return 'F';
};

const buildPerformanceSummary = (data = {}) => {
  const attendance = Number(data.attendance ?? 0);
  const taskCompletion = Number(data.taskCompletion ?? 0);
  const projectContribution = Number(data.projectContribution ?? 0);
  const lateComing = Number(data.lateComing ?? 0);
  const leave = Number(data.leave ?? 0);
  const managerRating = Number(data.managerRating ?? 0);
  const kpiScore = Number(data.kpiScore ?? 0);

  return {
    attendance,
    taskCompletion,
    projectContribution,
    lateComing,
    leave,
    managerRating,
    kpiScore,
    overallGrade: getOverallGrade(kpiScore),
  };
};

module.exports = {
  buildPerformanceSummary,
  getOverallGrade,
};
