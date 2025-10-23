// Hesaplama mantığı için temel fonksiyonlar

function calculate(expression) {
    try {
        return eval(expression);
    } catch (e) {
        return '⚠️ Hatalı işlem';
    }
}

// Event listener for key presses
document.addEventListener('keydown', function(event) {
    const key = event.key;
    if (key === 'Enter') {
        const input = document.getElementById('inputField').value;
        const result = calculate(input);
        document.getElementById('resultField').textContent = result;
    }
});