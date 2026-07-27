using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

internal static class GravityHelper
{
    private const string WindowTitle = "黑洞桌宠";
    private static volatile bool _running = true;
    private static volatile bool _enabled = true;
    private static double _strength = 1.25;
    private static long _windowHandle = 0;

    private delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    private struct Point
    {
        public int X;
        public int Y;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct Rect
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [StructLayout(LayoutKind.Sequential, Pack = 8)]
    private struct RecycleBinInfo
    {
        public uint Size;
        public long Bytes;
        public long Items;
    }

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr hwnd, StringBuilder text, int count);

    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr hwnd);

    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr hwnd, out Rect rect);

    [DllImport("user32.dll")]
    private static extern bool GetCursorPos(out Point point);

    [DllImport("user32.dll")]
    private static extern bool SetCursorPos(int x, int y);

    [DllImport("user32.dll")]
    private static extern bool SetProcessDPIAware();

    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    private static extern int SHQueryRecycleBin(string rootPath, ref RecycleBinInfo info);

    private static IntPtr FindPetWindow()
    {
        IntPtr found = IntPtr.Zero;
        EnumWindows(delegate(IntPtr hwnd, IntPtr ignored)
        {
            if (!IsWindowVisible(hwnd))
                return true;
            var title = new StringBuilder(64);
            GetWindowText(hwnd, title, title.Capacity);
            if (string.Equals(title.ToString(), WindowTitle, StringComparison.Ordinal))
            {
                found = hwnd;
                return false;
            }
            return true;
        }, IntPtr.Zero);
        return found;
    }

    private static void GravityLoop()
    {
        IntPtr hwnd = IntPtr.Zero;
        Rect rect = new Rect();
        int refresh = 0;
        while (_running)
        {
            Thread.Sleep(12);
            if (!_enabled || _strength <= 0.001)
                continue;

            var commandedHandle = new IntPtr(Interlocked.Read(ref _windowHandle));
            if (commandedHandle != IntPtr.Zero)
                hwnd = commandedHandle;

            if (hwnd == IntPtr.Zero || refresh++ >= 8 || !GetWindowRect(hwnd, out rect))
            {
                hwnd = FindPetWindow();
                refresh = 0;
                if (hwnd == IntPtr.Zero || !GetWindowRect(hwnd, out rect))
                    continue;
            }

            Point cursor;
            if (!GetCursorPos(out cursor))
                continue;

            var cx = (rect.Left + rect.Right) * 0.5;
            var cy = (rect.Top + rect.Bottom) * 0.5;
            var dx = cx - cursor.X;
            var dy = cy - cursor.Y;
            var distance = Math.Sqrt(dx * dx + dy * dy);
            var radius = Math.Min(rect.Right - rect.Left, rect.Bottom - rect.Top) * 0.46;
            if (distance < 5 || distance >= radius)
                continue;

            var influence = 1.0 - distance / radius;
            influence = influence * influence * (3.0 - 2.0 * influence);
            var force = Math.Min(7.2, (0.12 + influence * influence * 4.8) * _strength);
            var nx = dx / distance;
            var ny = dy / distance;
            var targetX = cursor.X + (int)Math.Round(nx * force);
            var targetY = cursor.Y + (int)Math.Round(ny * force);
            SetCursorPos(targetX, targetY);
        }
    }

    private static void ReadCommands()
    {
        string line;
        while (_running && (line = Console.ReadLine()) != null)
        {
            var parts = line.Trim().Split(' ');
            if (parts.Length == 0)
                continue;
            if (parts[0] == "quit")
            {
                _running = false;
                break;
            }
            if (parts[0] == "enabled" && parts.Length > 1)
            {
                _enabled = parts[1] != "0";
                continue;
            }
            if (parts[0] == "strength" && parts.Length > 1)
            {
                double value;
                if (double.TryParse(parts[1], System.Globalization.NumberStyles.Float,
                    System.Globalization.CultureInfo.InvariantCulture, out value))
                    _strength = Math.Max(0, Math.Min(2, value));
                continue;
            }
            if (parts[0] == "hwnd" && parts.Length > 1)
            {
                long value;
                if (long.TryParse(parts[1], out value))
                    Interlocked.Exchange(ref _windowHandle, value);
            }
        }
        _running = false;
    }

    private static void RecycleBinLoop()
    {
        while (_running)
        {
            var info = new RecycleBinInfo();
            info.Size = (uint)Marshal.SizeOf(typeof(RecycleBinInfo));
            if (SHQueryRecycleBin(null, ref info) == 0)
            {
                Console.WriteLine("recycle " + info.Items + " " + info.Bytes);
                Console.Out.Flush();
            }
            Thread.Sleep(1200);
        }
    }

    public static void Main()
    {
        try { SetProcessDPIAware(); } catch { }
        var worker = new Thread(GravityLoop) { IsBackground = true };
        var recycle = new Thread(RecycleBinLoop) { IsBackground = true };
        worker.Start();
        recycle.Start();
        ReadCommands();
        worker.Join(500);
    }
}
