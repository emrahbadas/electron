import random

number_to_guess = random.randint(1, 100)

while True:
    user_guess = int(input('1-100 arasında bir sayı tahmin edin: '))
    if user_guess < number_to_guess:
        print('Daha yüksek bir sayı tahmin edin.')
    elif user_guess > number_to_guess:
        print('Daha düşük bir sayı tahmin edin.')
    else:
        print('Tebrikler! Doğru tahmin ettiniz.')
        break