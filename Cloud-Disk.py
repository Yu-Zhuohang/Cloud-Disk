import sys
import os
import webview


def resource_path(relative_path):
    """ Get absolute path to resource, works for dev and for PyInstaller """
    base_path = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base_path, relative_path)


def main():
    index_path = resource_path('index.html')
    webview.create_window('', index_path)
    webview.start()


if __name__ == '__main__':
    main()