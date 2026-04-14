export const calculateTaxesAndTotals = (shopkeeperType, product, qty, settingsObj) => {
  const tp = product.rate;
  const pType = product.product_type;
  
  // settingsObj is now passed in asynchronously from Supabase
  let key = 'ur'; // default for 'None'
  if (shopkeeperType === 'IT') key = 'it';
  else if (shopkeeperType === 'Both') key = 'registered';
  
  const settings = settingsObj[key] || settingsObj['registered'];

  let gstPct = 0;
  let advPct = settings.advPct;
  let fixedGST = 0;

  if (pType === 'E') gstPct = settings.e;
  else if (pType === 'N') gstPct = settings.n;
  else if (pType === 'R') gstPct = settings.r;
  else if (pType === 'TS') {
      // The math formula used locally by Jazaa for TS
      // By default: (product.rp * TS Rate) / 118
      // Note: settings.ts holds 0.18 right now (i.e. 18%)
      fixedGST = (product.rp * (settings.ts * 100)) / (100 + (settings.ts * 100));
  }

  // Follow the Excel formula precisely
  let baseGST = pType === 'TS' ? fixedGST : (tp * gstPct);
  let baseAdv = (tp + baseGST) * advPct;
  let S = tp + baseGST + baseAdv; // Final Amount before FOC
  
  let T = S; // FOC Adjustment
  if (product.foc > 0 && product.main_qty > 0) {
     T = (S * product.main_qty) / (product.main_qty + product.foc);
  }
  
  // They use MROUND to nearest whole visually. We will do Math.round.
  let targetTotalForOne = Math.round(T); 
  
  // Now reverse-calculate beautifully for the TP Invoice Formats to match targetTotalForOne!
  // S_after_foc_ratio = T / S
  let ratio = T / S;
  
  let afterDiscRate = tp * ratio;
  let gstAmt = baseGST * ratio;
  let amtAfterGst = afterDiscRate + gstAmt;
  let advTaxAmt = amtAfterGst * advPct; // amtAfterGst * advPct should equal baseAdv * ratio
  
  let discAmt = tp - afterDiscRate;
  let discPctRP = 0;
  if (product.rp > 0) {
      discPctRP = ((product.rp - targetTotalForOne) / product.rp);
  }

  return {
      rate: tp,
      afterDiscRate: afterDiscRate,
      discPctTP: discAmt / tp,
      gstPct: pType === 'TS' ? 0 : gstPct,
      gstAmt: gstAmt,
      amtAfterGst: amtAfterGst,
      advPct: advPct,
      advTaxAmt: advTaxAmt,
      unitTotal: targetTotalForOne,
      total: targetTotalForOne * qty,
      // For RP Invoice
      rp: product.rp,
      discPctRP: discPctRP,
      rateAfterDiscRP: targetTotalForOne // as defined by user context
  };
};
