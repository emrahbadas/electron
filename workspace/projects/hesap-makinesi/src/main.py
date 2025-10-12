import tkinter as tk

class Calculator:
    def __init__(self, master):
        self.master = master
        master.title("Hesap Makinesi")

        self.result = tk.StringVar()
        self.create_widgets()

    def create_widgets(self):
        entry = tk.Entry(self.master, textvariable=self.result, font=('Arial', 24), bd=10, insertwidth=4, width=14)
        entry.grid(row=0, column=0, columnspan=4)

        buttons = [
            '7', '8', '9', '/',
            '4', '5', '6', '*',
            '1', '2', '3', '-',
            '0', '.', '=', '+'
        ]

        row_val = 1
        col_val = 0
        for button in buttons:
            self.create_button(button, row_val, col_val)
            col_val += 1
            if col_val > 3:
                col_val = 0
                row_val += 1

    def create_button(self, value, row, column):
        button = tk.Button(self.master, text=value, font=('Arial', 18), command=lambda: self.on_button_click(value))
        button.grid(row=row, column=column, sticky="nsew")

    def on_button_click(self, value):
        if value == '=':
            try:
                result = eval(self.result.get())
                self.result.set(result)
            except Exception:
                self.result.set('Hata')
        else:
            self.result.set(self.result.get() + value)

if __name__ == '__main__':
    root = tk.Tk()
    calculator = Calculator(root)
    root.mainloop()