from cx_Freeze import setup, Executable

setup(name='Hesap Makinesi', version='1.0', description='Basit Hesap Makinesi Uygulaması', executables=[Executable('src/main.py')])