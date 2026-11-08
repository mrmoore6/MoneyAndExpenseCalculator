const tasktInput = document.getElementById("taskInput");
const enterBtn = document.getElementById("enterBtn");
const clearBtn = document.getElementById("clearBtn");
const grossPayresult = document.getElementById("result");
const payFrequency = document.getElementById("payFrequency");
const hint = document.getElementById("hint");

// Shows what to type both as the placeholder and in the hint line above the box
// (the placeholder disappears while the box is focused, the hint always stays visible)
const setPrompt = (text) => {
  tasktInput.placeholder = text;
  hint.textContent = text;
};

// Input flow:
// 1 = pay rate, 2 = week 1 hours (or the only week), 3 = week 2 hours (biweekly only),
// 4 = monthly expenses, 5 = savings per paycheck, 6 = savings goal
let step = 1;
let frequency;
let pay;
let week1Hours;
let week2Hours;
let gross;
let income;
let taxList;
let payPeriods;
let monthlyExpenses;
let expensesPerPaycheck;
let availableMoney;
let savingsPerPaycheck;
let spendingMoney;
let goal;

// Reads the input as a number. Allows "$1,100" style input.
// Returns null if the value is empty, not a number, or below the minimum.
const readNumber = (min = 0) => {
  const raw = tasktInput.value.trim().replace(/[$,]/g, "");
  if (raw === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min) return null;
  return value;
};

const showError = (message) => {
  grossPayresult.textContent = message;
};

const nextStep = (newStep, placeholder) => {
  step = newStep;
  tasktInput.value = "";
  setPrompt(placeholder);
  grossPayresult.textContent = "";
};

enterBtn.addEventListener("click", () => {
  if (step === 1) {
    const value = readNumber(0);
    if (value === null || value === 0) {
      return showError("Please enter a valid hourly pay greater than 0.");
    }
    pay = value;
    // Lock in the pay frequency for this calculation
    frequency = payFrequency.value;
    payFrequency.disabled = true;
    payPeriods = frequency === "weekly" ? 52 : 26;
    nextStep(
      2,
      frequency === "weekly"
        ? "Hours worked: "
        : "Hours week 1: ",
    );
  } else if (step === 2) {
    const value = readNumber(0);
    if (value === null || value > 168) {
      return showError("Please enter valid hours (0–168).");
    }
    week1Hours = value;

    if (frequency === "biweekly") {
      nextStep(3, "Hours week 2: ");
    } else {
      week2Hours = 0;
      gross = grossPay(pay, week1Hours);
      finishPay();
    }
  } else if (step === 3) {
    const value = readNumber(0);
    if (value === null || value > 168) {
      return showError("Please enter valid hours (0–168).");
    }
    week2Hours = value;
    // Overtime is calculated separately for each week, then added together
    gross = grossPay(pay, week1Hours) + grossPay(pay, week2Hours);
    finishPay();
  } else if (step === 4) {
    const value = readNumber(0);
    if (value === null) {
      return showError("Please enter valid monthly expenses (0 or more).");
    }
    monthlyExpenses = value;
    expensesPerPaycheck = (monthlyExpenses * 12) / payPeriods;
    availableMoney = income - expensesPerPaycheck;
    nextStep(5, "Next: Amount to save per paycheck (e.g. 100)");
  } else if (step === 5) {
    const value = readNumber(0);
    if (value === null) {
      return showError("Please enter a valid savings amount (0 or more).");
    }
    savingsPerPaycheck = value;
    spendingMoney = availableMoney - savingsPerPaycheck;
    nextStep(6, "Last step: Savings goal in dollars (e.g. 20000)");
  } else if (step === 6) {
    const value = readNumber(0);
    if (value === null) {
      return showError("Please enter a valid savings goal (0 or more).");
    }
    goal = value;
    showResults();
    step = 7; // flow complete; press Clear to start over
    tasktInput.value = "";
    setPrompt("Done! Press Clear to start over");
  }
});

// After all hours are entered: calculate net pay and move to expenses
const finishPay = () => {
  income = netPay(gross);
  taxList = calculateTaxes(gross);
  nextStep(4, "Next: Total monthly bills/expenses (e.g. 1100)");
};

const money = (value) =>
  (value < 0 ? "-$" : "$") +
  Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const showResults = () => {
  let goalText;
  if (goal === 0) {
    goalText = "Months to Achieve Goal: 0<br>Years to Achieve Goal: 0.00";
  } else if (savingsPerPaycheck > 0) {
    // paychecks needed -> months (payPeriods paychecks per 12 months)
    const goalMonths = (goal / savingsPerPaycheck) * (12 / payPeriods);
    const goalYears = goalMonths / 12;
    goalText = `Months to Achieve Goal: about ${Math.ceil(goalMonths)}<br>
    Years to Achieve Goal: ${Math.ceil(goalYears)}`;
  } else {
    goalText = "Goal not reachable — savings per paycheck is $0.";
  }

  const hoursText =
    frequency === "biweekly"
      ? `Week 1 Hours: ${week1Hours} | Week 2 Hours: ${week2Hours}<br>`
      : `Hours: ${week1Hours}<br>`;

  grossPayresult.innerHTML = `
    <strong>Paycheck Breakdown (${frequency === "weekly" ? "Weekly" : "Biweekly"})</strong><br><br>

    ${hoursText}
    Gross Pay: ${money(gross)}<br>
    Net Pay: ${money(income)}<br>
    Expenses Per Paycheck: ${money(expensesPerPaycheck)}<br>

    <strong>Available After Bills: ${money(availableMoney)}</strong><br>
    Savings Per Paycheck: -${money(savingsPerPaycheck)}<br>

    <strong>Spending Money After Savings: ${money(spendingMoney)}</strong><br><br>

    Savings Goal: ${money(goal)}<br>
    ${goalText}
  `;
};

const grossPay = (pay, hours) => {
  let overtimePay = pay * 1.5;
  let overtimeHours = hours - 40;
  let grossPay;

  if (hours > 40) {
    grossPay = pay * 40 + overtimeHours * overtimePay;
  } else {
    grossPay = pay * hours;
  }
  return grossPay;
};

const calculateTaxes = (gross) => {
  const socialSecurityRate = 0.062;
  const medicareRate = 0.0145;
  const federalRate = 0.1;
  const stateRate = 0.03;
  const federal = gross * federalRate;
  const state = gross * stateRate;
  const medicare = gross * medicareRate;
  const social = gross * socialSecurityRate;
  const totalTaxes = social + medicare + federal + state;
  return { social, medicare, federal, state, totalTaxes };
};

const netPay = (gross) => {
  const deductions = calculateTaxes(gross);
  return gross - deductions.totalTaxes;
};

// Enter key submits, same as clicking Enter
tasktInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") enterBtn.click();
});

clearBtn.addEventListener("click", () => {
  step = 1;
  frequency = undefined;
  pay = week1Hours = week2Hours = undefined;
  gross = income = taxList = payPeriods = undefined;
  monthlyExpenses = expensesPerPaycheck = availableMoney = undefined;
  savingsPerPaycheck = spendingMoney = goal = undefined;
  payFrequency.disabled = false;
  tasktInput.value = "";
  setPrompt(
    "Step 1: Choose your pay frequency, then type your hourly pay rate (e.g. 17.50)",
  );
  grossPayresult.textContent = "";
  tasktInput.focus();
});
