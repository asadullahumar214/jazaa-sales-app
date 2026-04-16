export const calculateTaxesAndTotals = (shopkeeperType, product, qty, settingsObj, manualDiscPct = null) => {
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
      fixedGST = (product.rp * (settings.ts * 100)) / (100 + (settings.ts * 100));
  }

  let afterDiscRate, gstAmt, advTaxAmt, targetTotalForOne;

  if (manualDiscPct !== null) {
    // ERP Mode: Manual Discount Percentage is the driver
    afterDiscRate = tp * (1 - manualDiscPct);
    gstAmt = pType === 'TS' ? fixedGST : (afterDiscRate * gstPct);
    advTaxAmt = (afterDiscRate + gstAmt) * advPct;
    targetTotalForOne = Math.round(afterDiscRate + gstAmt + advTaxAmt);
    
    // Recalculate components based on rounding impact (proportional adjustment)
    const rawTotal = afterDiscRate + gstAmt + advTaxAmt;
    if (rawTotal > 0) {
      const roundingRatio = targetTotalForOne / rawTotal;
      afterDiscRate *= roundingRatio;
      gstAmt *= roundingRatio;
      advTaxAmt *= roundingRatio;
    }
  } else {
    // Legacy / Automated Mode: FOC/Ratio driven
    let baseGST = pType === 'TS' ? fixedGST : (tp * gstPct);
    let baseAdv = (tp + baseGST) * advPct;
    let S = tp + baseGST + baseAdv; 
    
    let T = S; 
    if (product.foc > 0 && product.main_qty > 0) {
       T = (S * product.main_qty) / (product.main_qty + product.foc);
    }
    
    targetTotalForOne = Math.round(T); 
    let ratio = targetTotalForOne / S;
    
    afterDiscRate = tp * ratio;
    gstAmt = baseGST * ratio;
    const amtAfterGst = afterDiscRate + gstAmt;
    advTaxAmt = amtAfterGst * advPct;
  }
  
  const discAmt = tp - afterDiscRate;
  let discPctRP = 0;
  if (product.rp > 0) {
      discPctRP = ((product.rp - targetTotalForOne) / product.rp);
  }

  // Floor Price Validation
  let floorPrice = 0;
  if (shopkeeperType === 'IT') floorPrice = product.min_price_it || 0;
  else if (shopkeeperType === 'Both') floorPrice = product.min_price_reg || 0;
  else floorPrice = product.min_price_ur || 0;

  const isBelowFloor = targetTotalForOne < floorPrice;

  return {
      productName: product.name,
      qty,
      rate: tp,
      afterDiscRate: afterDiscRate,
      discPctTP: discAmt / tp,
      gstPct: pType === 'TS' ? 0 : gstPct,
      gstAmt: gstAmt,
      amtAfterGst: afterDiscRate + gstAmt,
      advPct: advPct,
      advTaxAmt: advTaxAmt,
      unitTotal: targetTotalForOne,
      total: targetTotalForOne * qty,
      isBelowFloor,
      floorPrice,
      rp: product.rp,
      discPctRP: discPctRP,
      rateAfterDiscRP: targetTotalForOne
  };
};
