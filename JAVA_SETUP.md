# Manual Java 17 Setup Guide

## ⚠️ Issue: Java Version Mismatch

Your system has **Java 8**, but React Native with Expo SDK 54 requires **Java 11+** (Java 17 recommended).

**Error message:**
```
Dependency requires at least JVM runtime version 11. This build uses a Java 8 JVM.
```

---

## 🚀 Quick Fix (Option 1: Automated)

### Using PowerShell (Recommended)

1. **Right-click PowerShell** and select **"Run as Administrator"**

2. **Run the installation script:**
   ```powershell
   cd d:\job\app\sensors\smart-stim-app
   .\install-java17.ps1
   ```

3. **Close and reopen PowerShell** (to load new environment variables)

4. **Verify Java 17:**
   ```powershell
   java -version
   # Should show: openjdk version "17.x.x"
   ```

5. **Build your app:**
   ```powershell
   cd d:\job\app\sensors\smart-stim-app
   npm run android
   ```

---

## 📥 Manual Installation (Option 2)

### Download and Install Java 17

1. **Download Microsoft OpenJDK 17:**
   - Go to: https://learn.microsoft.com/en-us/java/openjdk/download
   - Download: **Microsoft Build of OpenJDK 17 (LTS)** for Windows x64
   - Or direct link: https://aka.ms/download-jdk/microsoft-jdk-17-windows-x64.msi

2. **Install Java 17:**
   - Run the downloaded `.msi` file
   - Follow the installation wizard
   - Default location: `C:\Program Files\Microsoft\jdk-17.x.x-hotspot`

3. **Set JAVA_HOME Environment Variable:**
   
   **Option A - Using PowerShell (as Administrator):**
   ```powershell
   # Set JAVA_HOME
   [System.Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Microsoft\jdk-17.0.13.11-hotspot", "Machine")
   
   # Add to PATH
   $javaPath = "C:\Program Files\Microsoft\jdk-17.0.13.11-hotspot\bin"
   $currentPath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
   [System.Environment]::SetEnvironmentVariable("Path", "$javaPath;$currentPath", "Machine")
   ```
   
   **Option B - Using System Properties (GUI):**
   - Press `Win + X` → Select "System"
   - Click "Advanced system settings"
   - Click "Environment Variables"
   - Under "System variables":
     - Click "New"
     - Variable name: `JAVA_HOME`
     - Variable value: `C:\Program Files\Microsoft\jdk-17.0.13.11-hotspot`
     - Click OK
   - Find "Path" variable in "System variables"
     - Click "Edit"
     - Click "New"
     - Add: `%JAVA_HOME%\bin`
     - Click OK

4. **Verify Installation:**
   - **Close all PowerShell/Command Prompt windows**
   - Open a **NEW PowerShell window**
   - Run:
     ```powershell
     java -version
     ```
   - Should show:
     ```
     openjdk version "17.0.x" 2024-xx-xx LTS
     OpenJDK Runtime Environment Microsoft-xxxxxxx (build 17.0.x+x-LTS)
     OpenJDK 64-Bit Server VM Microsoft-xxxxxxx (build 17.0.x+x-LTS, mixed mode, sharing)
     ```

5. **Build Your App:**
   ```powershell
   cd d:\job\app\sensors\smart-stim-app
   npm run android
   ```

---

## 🔧 Alternative: Use Chocolatey Package Manager

If you have [Chocolatey](https://chocolatey.org/) installed:

```powershell
# Run PowerShell as Administrator
choco install microsoft-openjdk17 -y

# Set JAVA_HOME (update version number if different)
[System.Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Microsoft\jdk-17.0.13.11-hotspot", "Machine")

# Restart PowerShell and verify
java -version
```

---

## ✅ After Installation Checklist

- [ ] Java 17 installed
- [ ] JAVA_HOME environment variable set
- [ ] PATH includes `%JAVA_HOME%\bin`
- [ ] Closed and reopened terminal
- [ ] `java -version` shows Java 17
- [ ] `$env:JAVA_HOME` shows correct path in PowerShell

---

## 🏃 Build Commands

Once Java 17 is set up:

```powershell
# Navigate to project
cd d:\job\app\sensors\smart-stim-app

# Clean previous builds (optional)
cd android
.\gradlew clean
cd ..

# Run the app
npm run android
```

---

## 🐛 Troubleshooting

### "java -version" still shows Java 8
- Make sure you **closed and reopened** PowerShell/CMD
- Check that JAVA_HOME is set correctly:
  ```powershell
  $env:JAVA_HOME
  # Should show: C:\Program Files\Microsoft\jdk-17.x.x-hotspot
  ```
- Check PATH includes Java 17:
  ```powershell
  $env:Path -split ';' | Select-String -Pattern 'jdk'
  ```

### "Could not find java" after installation
- Restart your computer to fully load environment variables
- Manually add Java to PATH (see step 3 above)

### Gradle still uses Java 8
- Set `org.gradle.java.home` in `gradle.properties`:
  ```properties
  org.gradle.java.home=C:\\Program Files\\Microsoft\\jdk-17.0.13.11-hotspot
  ```

### Multiple Java versions installed
- Edit your system PATH to prioritize Java 17
- Remove or move Java 8 paths lower in the PATH list

---

## 📚 Additional Resources

- [Microsoft OpenJDK Downloads](https://learn.microsoft.com/en-us/java/openjdk/download)
- [React Native Environment Setup](https://reactnative.dev/docs/environment-setup)
- [Expo Development Build](https://docs.expo.dev/develop/development-builds/introduction/)

---

## 💡 Why Java 17?

- **Expo SDK 54** requires Java 11+
- **Android Gradle Plugin 8.x** requires Java 17
- **React Native 0.81+** best supported with Java 17
- **Long-term support (LTS)** - stable and maintained

---

After following these steps, your build should succeed! 🎉
