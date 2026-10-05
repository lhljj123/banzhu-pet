Add-Type -AssemblyName System.Windows.Forms

$source = @'
using System;
using System.Runtime.InteropServices;
using System.Windows.Forms;

public sealed class DisplayPowerMonitor : NativeWindow, IDisposable
{
    private const int WM_POWERBROADCAST = 0x0218;
    private const int PBT_POWERSETTINGCHANGE = 0x8013;
    private static readonly Guid ConsoleDisplayState = new Guid("6FE69556-704A-47A0-8F24-C28D936FDA47");
    private IntPtr notificationHandle;

    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    private struct PowerBroadcastSetting
    {
        public Guid PowerSetting;
        public int DataLength;
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr RegisterPowerSettingNotification(IntPtr recipient, ref Guid settingGuid, int flags);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool UnregisterPowerSettingNotification(IntPtr handle);

    public DisplayPowerMonitor()
    {
        CreateHandle(new CreateParams());
        Guid setting = ConsoleDisplayState;
        notificationHandle = RegisterPowerSettingNotification(Handle, ref setting, 0);
    }

    protected override void WndProc(ref Message message)
    {
        if (message.Msg == WM_POWERBROADCAST && message.WParam.ToInt32() == PBT_POWERSETTINGCHANGE)
        {
            PowerBroadcastSetting setting = Marshal.PtrToStructure<PowerBroadcastSetting>(message.LParam);
            if (setting.PowerSetting == ConsoleDisplayState && setting.DataLength >= 4)
            {
                int value = Marshal.ReadInt32(IntPtr.Add(message.LParam, Marshal.SizeOf<PowerBroadcastSetting>()));
                Console.WriteLine(value == 0 ? "DISPLAY_OFF" : "DISPLAY_ON");
                Console.Out.Flush();
            }
        }
        base.WndProc(ref message);
    }

    public void Dispose()
    {
        if (notificationHandle != IntPtr.Zero) UnregisterPowerSettingNotification(notificationHandle);
        DestroyHandle();
    }
}
'@

Add-Type -TypeDefinition $source -ReferencedAssemblies System.Windows.Forms
$monitor = [DisplayPowerMonitor]::new()
try {
    [System.Windows.Forms.Application]::Run()
} finally {
    $monitor.Dispose()
}
