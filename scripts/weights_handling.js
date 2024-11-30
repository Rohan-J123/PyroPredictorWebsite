for (let i = 0; i < 20; i++) {
    document.getElementById('weightSlider' + String(i)).addEventListener('input', function(e) {
        var weightValue = parseFloat(e.target.value);
        document.getElementById('weightLabel' + String(i)).value = weightValue.toFixed(2);
    });

    document.getElementById('weightLabel' + String(i)).addEventListener('input', function(e) {
        var weightValue = parseFloat(e.target.value);
        document.getElementById('weightSlider' + String(i)).value = weightValue.toFixed(2);
    });

    document.getElementById('weightLabel' + String(i)).addEventListener('blur', function(e) {
        var weightValue = parseFloat(e.target.value);
        if (!isNaN(weightValue)) {
            e.target.value = weightValue.toFixed(2);
            if (weightValue < 0) {
                e.target.value = '0.00';
            }
            else if (weightValue > 1) {
                e.target.value = '1.00';
            }
        }
    });
}

function resetWeights(){
    for (let i = 0; i < 20; i++) {
        document.getElementById('weightSlider' + String(i)).value = (1).toFixed(2);
    
        document.getElementById('weightLabel' + String(i)).value = (1).toFixed(2);
    }
}