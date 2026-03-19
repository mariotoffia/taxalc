/**
 * TaxCalc — Delad beräkningsmotor för uthyrning av privatbostad (småhus).
 * Exponeras som window.TaxCalc.
 */
(function () {
    'use strict';

    const TAX_RULES = {
        2025: {
            schablonavdrag: 40000,
            percentAvdrag: 20,
            kapitalskatt: 30,
            ranteavdrag: 30,
            proposed: false
        },
        2026: {
            schablonavdrag: 50000,
            percentAvdrag: 20,
            kapitalskatt: 30,
            ranteavdrag: 30,
            proposed: true
        }
    };

    function getTaxRules(year) {
        return TAX_RULES[year] || TAX_RULES[2025];
    }

    function getAvailableYears() {
        return Object.keys(TAX_RULES).map(Number);
    }

    /** Månatlig räntekostnad. */
    function calculateMortgage(loan, interestRatePercent) {
        if (loan <= 0 || interestRatePercent <= 0) return 0;
        return (loan / 12) * (interestRatePercent / 100);
    }

    /** Räntekostnad efter ränteavdrag. */
    function calculateDeductedMortgage(mortgage, ranteavdragPercent) {
        return mortgage * (1 - ranteavdragPercent / 100);
    }

    /**
     * Summera alla månadskostnader.
     * @param {object} c - Kostnadsposter (månadsvärden).
     */
    function calculateTotalCost(c) {
        return (c.heating || 0) + (c.garbage || 0) + (c.chimney || 0) +
            (c.broadband || 0) + (c.renovation || 0) + (c.insurance || 0) +
            (c.baseCost || 0) + (c.deductedMortgage || 0) +
            (c.repayment || 0) + (c.propertyTaxMonthly || 0);
    }

    /** Iterativ lösare — hittar hyra för ett givet steg. */
    function calculateTenantRentNumerically(
        tenantRentStart, totalCost, percentDeduction,
        fixedDeductionMonthly, capitalGainTax, step
    ) {
        if (totalCost <= (fixedDeductionMonthly + (tenantRentStart * percentDeduction))) {
            return totalCost;
        }

        let tenantRent = tenantRentStart;
        let lastTest = tenantRentStart;

        for (let i = tenantRentStart; i > totalCost; i -= step) {
            const taxableIncome = i - ((i * percentDeduction) + fixedDeductionMonthly);
            const tax = taxableIncome * capitalGainTax;
            const net = i - tax;

            if (net <= totalCost) {
                tenantRent = net === totalCost ? i : lastTest;
                break;
            }
            lastTest = i;
        }
        return tenantRent || 0;
    }

    /**
     * Beräkna break-even-hyra med progressiv förfining.
     * @returns {number} Månatlig hyra.
     */
    function solveBreakEvenRent(totalCost, percentDeductionPct, fixedDeductionYearly, capitalGainTaxPct) {
        const pd = percentDeductionPct / 100;
        const cgt = capitalGainTaxPct / 100;
        const fdm = fixedDeductionYearly / 12;

        let estimate = totalCost / (1 - cgt);
        const steps = [100, 10, 1, 0.1, 0.01];

        steps.forEach(function (step) {
            estimate = calculateTenantRentNumerically(estimate, totalCost, pd, fdm, cgt, step);
        });
        return estimate;
    }

    /** Naiv uppskattning utan hänsyn till avdrag. */
    function calculateNaiveRent(totalCost, capitalGainTaxPct) {
        return totalCost / (1 - capitalGainTaxPct / 100);
    }

    /** Beskattningsbar inkomst (månad). */
    function calculateTaxableIncome(rentMonthly, percentDeductionPct, fixedDeductionYearly) {
        const val = rentMonthly - ((rentMonthly * percentDeductionPct / 100) + fixedDeductionYearly / 12);
        return Math.max(0, val);
    }

    /** Skatt (månad). */
    function calculateTax(taxableIncome, capitalGainTaxPct) {
        return taxableIncome * (capitalGainTaxPct / 100);
    }

    /**
     * Beräkna en ägares andel av deklarationsunderlaget (årsbelopp).
     * @param {object} params
     * @param {number} params.monthlyRent      - Total månadshyra
     * @param {number} params.months            - Antal uthyrningsmånader
     * @param {number} params.schablonavdrag    - Totalt schablonavdrag (år)
     * @param {number} params.percentDeduction  - Procentavdrag (t.ex. 20)
     * @param {number} params.capitalGainTax    - Kapitalskatt (t.ex. 30)
     * @param {number} ownershipPercent         - Ägarandel i %
     * @returns {object} Ägarens deklarationsdata.
     */
    function calculateOwnerShare(params, ownershipPercent) {
        const share = ownershipPercent / 100;
        const yearlyRent = params.monthlyRent * (params.months || 12);
        const income = yearlyRent * share;
        const schablon = params.schablonavdrag * share;
        const percentAvdrag = income * (params.percentDeduction / 100);
        const taxable = Math.max(0, income - schablon - percentAvdrag);
        const tax = taxable * (params.capitalGainTax / 100);

        return {
            ownershipPercent: ownershipPercent,
            income: income,
            schablonavdrag: schablon,
            percentAvdrag: percentAvdrag,
            taxable: taxable,
            tax: tax
        };
    }

    /**
     * Kör fullständig beräkning.
     * @param {object} inputs - Alla inmatningsvärden.
     * @returns {object} Beräkningsresultat.
     */
    function fullCalculation(inputs) {
        const mortgage = (inputs.loan > 0 && inputs.rent > 0)
            ? calculateMortgage(inputs.loan, inputs.rent)
            : (inputs.mortgage || 0);

        const deductedMortgage = calculateDeductedMortgage(mortgage, inputs.percentMortgageDeduction);

        const totalCost = calculateTotalCost({
            heating: inputs.heating,
            garbage: inputs.garbage,
            chimney: inputs.chimney,
            broadband: inputs.broadband,
            renovation: inputs.renovation,
            insurance: inputs.insurance,
            baseCost: inputs.baseCost,
            deductedMortgage: deductedMortgage,
            repayment: inputs.repayment,
            propertyTaxMonthly: inputs.propertyTax / 12
        });

        const naiveRent = calculateNaiveRent(totalCost, inputs.capitalGainTax);
        const tenantRent = solveBreakEvenRent(
            totalCost, inputs.percentDeduction,
            inputs.fixedDeduction, inputs.capitalGainTax
        );
        const taxableIncome = calculateTaxableIncome(
            tenantRent, inputs.percentDeduction, inputs.fixedDeduction
        );
        const tax = calculateTax(taxableIncome, inputs.capitalGainTax);

        return {
            mortgage: mortgage,
            deductedMortgage: deductedMortgage,
            totalCost: totalCost,
            naiveRent: naiveRent,
            tenantRent: tenantRent,
            taxableIncome: taxableIncome,
            tax: tax
        };
    }

    window.TaxCalc = {
        getTaxRules: getTaxRules,
        getAvailableYears: getAvailableYears,
        calculateMortgage: calculateMortgage,
        calculateDeductedMortgage: calculateDeductedMortgage,
        calculateTotalCost: calculateTotalCost,
        solveBreakEvenRent: solveBreakEvenRent,
        calculateNaiveRent: calculateNaiveRent,
        calculateTaxableIncome: calculateTaxableIncome,
        calculateTax: calculateTax,
        calculateOwnerShare: calculateOwnerShare,
        fullCalculation: fullCalculation
    };
})();
