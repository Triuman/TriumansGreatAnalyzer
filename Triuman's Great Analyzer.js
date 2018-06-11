/* 
- How many pips can I earn on a pair with these settings?
Input: 
        symbol,
        take_profit_waiting_time,
        stop_loss_spread_count,
        take_profit_spread_count
Output:
        pip count

- With what settings I can earn most on a pair?
Input:
        symbol
Output: 
        take_profit_waiting_time,
        stop_loss_spread_count,
        take_profit_spread_count

- Show time/profit chart of a pair
Input:
        symbol
Output:
        graph showing 24 hours with their profits

*/

var ClosingReasons = {
    PROGRAM: 0,
    TAKE_PROFIT: 1,
    STOP_LOSS: 2
};

function HowMuchCanIEarn(symbol, take_profit_waiting_time, stop_loss_spread_count, take_profit_spread_count, start_time, end_time) {
    var pips_to_earn = 0;
    for (var d in DATA) {
        if (DATA[d].symbol != symbol)
            continue;

        for (var p in DATA[d].positions) {
            position = DATA[d].positions[p];
            if(start_time && end_time){
                var position_time = parseDateToTime(position.open_date);
                if (compare_times(start_time, position_time) == -1 || compare_times(end_time, position_time) == 1) {
                    continue;
                }
            }
            var pip_to_earn = 0;
            //If position was never positive and it was closed by stoploss, we assume stoploss will be hit for these settings.
            if (position.max_min_profits.length == 1 && position.closing_reason == ClosingReasons.STOP_LOSS) {
                pip_to_earn = -Math.ceil(stop_loss_spread_count * DATA[d].spread); //We cannot lose half pip.
                continue;
            }
            for (var m in position.max_min_profits) {
                var max_price = position.max_min_profits[m];
                if (max_price.price_difference_as_spread > 0) {
                    //see if we can close the order and take our profit with either tp or take_profit_waiting_time
                    if (max_price.price_difference_as_spread >= take_profit_spread_count) {
                        pip_to_earn = Math.ceil(take_profit_spread_count * DATA[d].spread); //We cannot earn half pip.
                        break;
                    } else if (max_price.start_time <= take_profit_waiting_time && max_price.end_time >= take_profit_waiting_time) {
                        pip_to_earn = Math.ceil(max_price.price_difference_as_spread * DATA[d].spread);
                        pip_to_earn = pip_to_earn < 1 ? 1 : pip_to_earn; //we will earn at least 1 pip.
                        break;
                    }else if(max_price.start_time > take_profit_waiting_time){
                        pip_to_earn = Math.ceil((take_profit_waiting_time / max_price.start_time) * max_price.price_difference_as_spread * DATA[d].spread);
                        pip_to_earn = pip_to_earn < 1 ? 1 : pip_to_earn; //we will earn at least 1 pip.
                        break;
                    }else if(max_price.end_time < take_profit_waiting_time){
                        pip_to_earn = Math.ceil(((max_price.start_time-(take_profit_waiting_time-max_price.end_time)) / max_price.start_time) * max_price.price_difference_as_spread * DATA[d].spread);
                        pip_to_earn = pip_to_earn < 1 ? 1 : pip_to_earn; //we will earn at least 1 pip.
                        break;
                    }
                } else {
                    //see if price hits our sl
                    if (-max_price.price_difference_as_spread >= stop_loss_spread_count) {
                        pip_to_earn = -Math.ceil(stop_loss_spread_count * DATA[d].spread); //We cannot lose half pip.
                        break;
                    }
                }
            }
            if (pip_to_earn == 0) {
                //if we couldnt determine pip to earn yet, the given stop loss or take profit might be bigger than positions'. So we check if position ended negative or positive. Then select the lowest tp or sl.
                if (position.profit > 0) {
                    pip_to_earn = Math.min(take_profit_spread_count, DATA[d].take_profit_spread_count) * DATA[d].spread;
                } else {
                    pip_to_earn = -Math.min(stop_loss_spread_count, DATA[d].stop_loss_spread_count) * DATA[d].spread;
                }
            }
            pips_to_earn += pip_to_earn;
        }
    }
    return pips_to_earn;
}

function GetSettingsForMaximumProfit(symbol) {

    var settings_for_maximum_profit = {
        take_profit_waiting_time: 0,
        stop_loss_spread_count: 0,
        take_profit_spread_count: 0,
        profit: 0
    };
    var settings_for_minimum_profit = {
        take_profit_waiting_time: 0,
        stop_loss_spread_count: 0,
        take_profit_spread_count: 0,
        profit: 0
    };
    var totalProfit = 0; //We sum all the possible profits

    var MaxProfitWaitingTime = 100000; //ms
    var MaxProfitWaitingTimeStepSize = 1000; //ms
    var MaxTakeProfitSpreadCount = 10;
    var MaxStopLossSpreadCount = 10;
    var Spread = GetSpread(symbol);
    if (Spread == 0) {
        console.log(symbol + " could not found in DATA.");
        return { settings_for_maximum_profit, settings_for_minimum_profit, totalProfit };
    }

    var currentProfitWaitingTime = MaxProfitWaitingTime;
    var maxProfit = 0;
    var minProfit = 0;
    for (var p = 0; p < MaxProfitWaitingTime / MaxProfitWaitingTimeStepSize; p++) {
        var currentTakeProfitSpreadCount = MaxTakeProfitSpreadCount;
        for (var t = 0; t < MaxTakeProfitSpreadCount * Spread; t++) {
            var currentStopLossSpreadCount = MaxStopLossSpreadCount;
            for (var s = 0; s < MaxStopLossSpreadCount * Spread; s++) {
                var currentProfit = HowMuchCanIEarn(symbol, currentProfitWaitingTime, currentStopLossSpreadCount, currentTakeProfitSpreadCount);
                totalProfit += currentProfit;
                if (currentProfit >= maxProfit) {
                    settings_for_maximum_profit.take_profit_waiting_time = currentProfitWaitingTime;
                    settings_for_maximum_profit.take_profit_spread_count = currentTakeProfitSpreadCount;
                    settings_for_maximum_profit.stop_loss_spread_count = currentStopLossSpreadCount;
                    settings_for_maximum_profit.profit = currentProfit;
                    maxProfit = currentProfit;
                }
                if (currentProfit <= minProfit) {
                    settings_for_minimum_profit.take_profit_waiting_time = currentProfitWaitingTime;
                    settings_for_minimum_profit.take_profit_spread_count = currentTakeProfitSpreadCount;
                    settings_for_minimum_profit.stop_loss_spread_count = currentStopLossSpreadCount;
                    settings_for_minimum_profit.profit = currentProfit;
                    minProfit = currentProfit;
                }
                currentStopLossSpreadCount -= 1 / Spread;
            }
            currentTakeProfitSpreadCount -= 1 / Spread;
        }
        currentProfitWaitingTime -= MaxProfitWaitingTimeStepSize;
    }
    return { settings_for_maximum_profit, settings_for_minimum_profit, totalProfit };
}


function GetSpread(symbol) {
    for (var d in DATA)
        if (DATA[d].symbol == symbol)
            return DATA[d].spread;
    return 0;
}

function GetBestSettingsClick() {
    var selectSymbol = document.getElementById("selectSymbol");
    var symbol = selectSymbol.options[selectSymbol.selectedIndex].value;
    var max_settings = GetSettingsForMaximumProfit(symbol);
    var divResult = document.getElementById("divResult");
    divResult.innerHTML = "";

    divResult.innerHTML += "<div style='margin-top:20px;'>Best settings for " + symbol + "</div>";
    var best_settings_string = "<div>";
    best_settings_string += "<div>Take Profit Waiting Time: " + max_settings.settings_for_maximum_profit.take_profit_waiting_time + "</div>";
    best_settings_string += "<div>Take Profit Spread Count: " + max_settings.settings_for_maximum_profit.take_profit_spread_count + "</div>";
    best_settings_string += "<div>Stop Loss Spread Count: " + max_settings.settings_for_maximum_profit.stop_loss_spread_count + "</div>";
    best_settings_string += "<div>Your Profit in Pips: " + max_settings.settings_for_maximum_profit.profit + "</div>";
    best_settings_string += "</div>";
    divResult.innerHTML += best_settings_string;


    divResult.innerHTML += "<div style='margin-top:20px;'>Worst settings for " + symbol + "</div>";
    var worst_settings_string = "<div>";
    worst_settings_string += "<div>Take Profit Waiting Time: " + max_settings.settings_for_minimum_profit.take_profit_waiting_time + "</div>";
    worst_settings_string += "<div>Take Profit Spread Count: " + max_settings.settings_for_minimum_profit.take_profit_spread_count + "</div>";
    worst_settings_string += "<div>Stop Loss Spread Count: " + max_settings.settings_for_minimum_profit.stop_loss_spread_count + "</div>";
    worst_settings_string += "<div>Your Profit in Pips: " + max_settings.settings_for_minimum_profit.profit + "</div>";
    worst_settings_string += "</div>";
    divResult.innerHTML += worst_settings_string;


    divResult.innerHTML += "<div style='margin-top:20px;'>Total profit of all settings: " + max_settings.totalProfit + "</div>";

    document.getElementById("txtProfitWaitingTime").value=max_settings.settings_for_maximum_profit.take_profit_waiting_time;
    document.getElementById("txtTakeProfitSpreadCount").value=max_settings.settings_for_maximum_profit.take_profit_spread_count;
    document.getElementById("txtStopLossSpreadCount").value=max_settings.settings_for_maximum_profit.stop_loss_spread_count;
}

function compare_times(time1, time2) {
    var time1value = time1.hour * 60 + time1.minute;
    var time2value = time2.hour * 60 + time2.minute;

    if (time1value > time2value)
        return -1;
    if (time1value < time2value)
        return 1;
    if (time1value == time2value)
        return 0;
}

function parseDateToTime(datetime) {
    var timearray = datetime.split(" ")[1].split(":");
    return {
        hour: parseInt(timearray[0]),
        minute: parseInt(timearray[1])
    };
}


google.charts.load('current', { 'packages': ['corechart'] });
google.charts.setOnLoadCallback(initChart);
var googleChart;
function initChart() {
    googleChart = new google.visualization.LineChart(document.getElementById('curve_chart'));
}
function ShowProfitByHour(symbol, take_profit_waiting_time, stop_loss_spread_count, take_profit_spread_count) {
    var selectSymbol = document.getElementById("selectSymbol");
    var symbol = selectSymbol.options[selectSymbol.selectedIndex].value;
    take_profit_waiting_time= parseInt(document.getElementById("txtProfitWaitingTime").value);
    take_profit_spread_count= parseFloat(document.getElementById("txtTakeProfitSpreadCount").value);
    stop_loss_spread_count= parseFloat(document.getElementById("txtStopLossSpreadCount").value);
    
    var time_profit_array = [['Time', 'Profit']];
    for (var h = 0; h < 24; h++) {
        var start_time = { hour: h, minute: 0 };
        var end_time = { hour: h, minute: 59 };
        var profit = HowMuchCanIEarn(symbol, take_profit_waiting_time, stop_loss_spread_count, take_profit_spread_count, start_time, end_time);
        time_profit_array.push([h + ":00", profit]);
    }
    var data = google.visualization.arrayToDataTable(time_profit_array);
    var options = {
        title: 'Profit by Hour ' + symbol,
        curveType: 'none',
        legend: { position: 'bottom' }
    };
    googleChart.draw(data, options);
}