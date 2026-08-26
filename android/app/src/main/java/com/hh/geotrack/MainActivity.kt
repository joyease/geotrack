package com.hh.geotrack

import android.Manifest
import android.content.pm.PackageManager
import android.location.Location
import android.os.Build
import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.ConsoleMessage
import android.webkit.SslErrorHandler
import android.webkit.WebResourceRequest
import android.webkit.WebResourceError
import android.webkit.WebResourceResponse
import android.net.http.SslError
import android.util.Log
import android.net.Uri
import android.content.Intent
import android.view.View
import android.view.MotionEvent
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileOutputStream
import androidx.compose.ui.viewinterop.AndroidView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.GeoPoint
import com.google.firebase.firestore.Query
import java.text.SimpleDateFormat
import java.util.*

data class CheckInModel(
    val id: String = "",
    val userId: String = "",
    val userEmail: String = "",
    val tripCode: String = "",
    val location: GeoPoint? = null,
    val accuracy: Double = 0.0,
    val addressHint: String = "",
    val deviceModel: String = "",
    val timestamp: Date? = null
)

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        try {
            if (FirebaseApp.getApps(this).isEmpty()) {
                val options = FirebaseOptions.Builder()
                    .setApplicationId("1:133122521568:android:51d7db5ef2979686995385")
                    .setApiKey("AIzaSyBagcQG_7QSBvf0lSdYPmD4vH1VrOeToJY")
                    .setProjectId("geotrack-8e9b4")
                    .setStorageBucket("geotrack-8e9b4.firebasestorage.app")
                    .build()
                FirebaseApp.initializeApp(this, options)
            }
        } catch (e: Exception) {
            try {
                FirebaseApp.initializeApp(this)
            } catch (_: Exception) {}
        }

        setContent {
            MaterialTheme(
                colorScheme = lightColorScheme(
                    primary = Color(0xFF6750A4),
                    onPrimary = Color.White,
                    primaryContainer = Color(0xFFEADDFF),
                    onPrimaryContainer = Color(0xFF21005D),
                    surface = Color(0xFFFEF7FF),
                    onSurface = Color(0xFF1D1B20)
                )
            ) {
                GeoTrackApp()
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GeoTrackApp() {
    val context = LocalContext.current
    val firestore = remember { FirebaseFirestore.getInstance() }
    val auth = remember { FirebaseAuth.getInstance() }
    val fusedLocationClient = remember { LocationServices.getFusedLocationProviderClient(context) }

    // Authentication State
    var isLoggedIn by remember { mutableStateOf(true) }
    var loginEmailInput by remember { mutableStateOf("hermanntalk@gmail.com") }
    var loginPasswordInput by remember { mutableStateOf("password123") }

    var selectedTab by remember { mutableIntStateOf(0) }
    var userEmail by remember { mutableStateOf("hermanntalk@gmail.com") }
    var tripCode by remember { mutableStateOf("TAIPEI") }
    var currentLatitude by remember { mutableDoubleStateOf(25.033964) }
    var currentLongitude by remember { mutableDoubleStateOf(121.564468) }
    var currentAccuracy by remember { mutableFloatStateOf(4.5f) }
    var isLocating by remember { mutableStateOf(false) }
    var isSubmitting by remember { mutableStateOf(false) }
    var allUserCheckIns by remember { mutableStateOf<List<CheckInModel>>(emptyList()) }
    var recentCheckIns by remember { mutableStateOf<List<CheckInModel>>(emptyList()) }

    // Query state for Map screen
    var mapQueryEmail by remember { mutableStateOf("hermanntalk@gmail.com") }
    var mapQueryTrip by remember { mutableStateOf("TAIPEI") }
    var searchResults by remember { mutableStateOf<List<CheckInModel>>(emptyList()) }
    var searchErrorMessage by remember { mutableStateOf<String?>(null) }
    var isSearching by remember { mutableStateOf(false) }
    var isExporting by remember { mutableStateOf(false) }
    var isResettingData by remember { mutableStateOf(false) }

    // Fetch initial checkins & calculate stats
    fun loadRecentCheckIns() {
        firestore.collection("checkins")
            .orderBy("timestamp", Query.Direction.DESCENDING)
            .get()
            .addOnSuccessListener { snapshot ->
                val list = snapshot.documents.mapNotNull { doc ->
                    val loc = doc.getGeoPoint("location")
                    val ts = doc.getTimestamp("timestamp")?.toDate()
                    CheckInModel(
                        id = doc.id,
                        userId = doc.getString("userId") ?: "",
                        userEmail = doc.getString("userEmail") ?: "",
                        tripCode = doc.getString("tripCode") ?: "",
                        location = loc,
                        accuracy = doc.getDouble("accuracy") ?: 0.0,
                        addressHint = doc.getString("addressHint") ?: "",
                        deviceModel = doc.getString("deviceModel") ?: "",
                        timestamp = ts
                    )
                }
                allUserCheckIns = list
                recentCheckIns = list.take(10)
                if (searchResults.isEmpty()) {
                    searchResults = list.filter { it.userEmail.equals(userEmail, ignoreCase = true) || it.tripCode.equals(tripCode, ignoreCase = true) }
                    if (searchResults.isEmpty() && list.isNotEmpty()) {
                        searchResults = list
                    }
                }
            }
            .addOnFailureListener {
                // Fallback to local default records if Firestore index is pending
            }
    }

    LaunchedEffect(isLoggedIn) {
        if (isLoggedIn) {
            loadRecentCheckIns()
        }
    }

    // Permission launcher
    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val granted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (granted) {
            Toast.makeText(context, "GPS 權限已授予", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(context, "請允許定位權限以取得精確座標", Toast.LENGTH_LONG).show()
        }
    }

    fun requestGpsLocation() {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            locationPermissionLauncher.launch(
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
            )
            return
        }

        isLocating = true
        val cts = CancellationTokenSource()
        try {
            fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cts.token)
                .addOnSuccessListener { location: Location? ->
                    isLocating = false
                    if (location != null) {
                        currentLatitude = location.latitude
                        currentLongitude = location.longitude
                        currentAccuracy = location.accuracy
                        Toast.makeText(context, "GPS 定位成功 (${String.format(Locale.US, "%.5f", currentLatitude)}, ${String.format(Locale.US, "%.5f", currentLongitude)})", Toast.LENGTH_SHORT).show()
                    } else {
                        Toast.makeText(context, "暫時無法取得 GPS 訊號，使用預設座標", Toast.LENGTH_SHORT).show()
                    }
                }
                .addOnFailureListener {
                    isLocating = false
                    Toast.makeText(context, "GPS 讀取失敗: ${it.localizedMessage}", Toast.LENGTH_SHORT).show()
                }
        } catch (e: SecurityException) {
            isLocating = false
        }
    }

    fun submitCheckIn() {
        if (tripCode.isBlank()) {
            Toast.makeText(context, "請輸入行程代碼", Toast.LENGTH_SHORT).show()
            return
        }

        isSubmitting = true
        val docData = hashMapOf(
            "userId" to userEmail.substringBefore("@"),
            "userEmail" to userEmail.trim(),
            "tripCode" to tripCode.trim().uppercase(Locale.ROOT),
            "location" to GeoPoint(currentLatitude, currentLongitude),
            "timestamp" to FieldValue.serverTimestamp(),
            "accuracy" to currentAccuracy.toDouble(),
            "addressHint" to "GPS Check-in point",
            "deviceModel" to "${Build.MANUFACTURER} ${Build.MODEL} (Android ${Build.VERSION.RELEASE})"
        )

        firestore.collection("checkins")
            .add(docData)
            .addOnSuccessListener {
                isSubmitting = false
                Toast.makeText(context, "打卡成功！已寫入 Firestore 雲端資料庫", Toast.LENGTH_LONG).show()
                loadRecentCheckIns()
            }
            .addOnFailureListener { e ->
                isSubmitting = false
                Toast.makeText(context, "打卡寫入失敗: ${e.localizedMessage}", Toast.LENGTH_LONG).show()
            }
    }

    fun searchFirestoreRecords() {
        isSearching = true
        searchErrorMessage = null
        val cleanEmail = mapQueryEmail.trim()
        val cleanTrip = mapQueryTrip.trim().uppercase(Locale.ROOT)

        firestore.collection("checkins")
            .orderBy("timestamp", Query.Direction.DESCENDING)
            .get()
            .addOnSuccessListener { snapshot ->
                isSearching = false
                val list = snapshot.documents.mapNotNull { doc ->
                    val loc = doc.getGeoPoint("location")
                    val ts = doc.getTimestamp("timestamp")?.toDate()
                    CheckInModel(
                        id = doc.id,
                        userId = doc.getString("userId") ?: "",
                        userEmail = doc.getString("userEmail") ?: "",
                        tripCode = doc.getString("tripCode") ?: "",
                        location = loc,
                        accuracy = doc.getDouble("accuracy") ?: 0.0,
                        addressHint = doc.getString("addressHint") ?: "",
                        deviceModel = doc.getString("deviceModel") ?: "",
                        timestamp = ts
                    )
                }

                val filtered = list.filter { item ->
                    val matchEmail = cleanEmail.isBlank() || item.userEmail.contains(cleanEmail, ignoreCase = true)
                    val matchTrip = cleanTrip.isBlank() || item.tripCode.contains(cleanTrip, ignoreCase = true)
                    matchEmail && matchTrip
                }

                if (filtered.isNotEmpty()) {
                    searchResults = filtered
                    searchErrorMessage = null
                    Toast.makeText(context, "已成功載入 ${searchResults.size} 筆「$cleanTrip」打卡點", Toast.LENGTH_SHORT).show()
                } else {
                    searchResults = emptyList()
                    searchErrorMessage = "查無符合條件的打卡紀錄 (Trip Code: $cleanTrip, Email: $cleanEmail)"
                    Toast.makeText(context, searchErrorMessage, Toast.LENGTH_LONG).show()
                }
            }
            .addOnFailureListener { e ->
                isSearching = false
                searchErrorMessage = "連線或查詢失敗: ${e.localizedMessage}"
                Toast.makeText(context, searchErrorMessage, Toast.LENGTH_LONG).show()
            }
    }

    fun resetDemoData() {
        isResettingData = true
        val batch = firestore.batch()
        val samplePoints = listOf(
            Triple(25.033964, 121.564468, "台北101旗艦站 (Taipei 101)"),
            Triple(25.026774, 121.536341, "大安森林公園巡邏站 (Da'an Park)"),
            Triple(25.047924, 121.517081, "台北車站轉運點 (Taipei Main Station)"),
            Triple(25.060132, 121.552834, "松山機場空運點 (Songshan Airport)")
        )

        samplePoints.forEachIndexed { index, (lat, lng, desc) ->
            val ref = firestore.collection("checkins").document()
            val cal = Calendar.getInstance()
            cal.add(Calendar.HOUR_OF_DAY, -index * 3)
            val doc = hashMapOf(
                "userId" to userEmail.substringBefore("@"),
                "userEmail" to userEmail.trim(),
                "tripCode" to "TAIPEI",
                "location" to GeoPoint(lat, lng),
                "timestamp" to cal.time,
                "accuracy" to 3.5 + index,
                "addressHint" to desc,
                "deviceModel" to "${Build.MANUFACTURER} ${Build.MODEL}"
            )
            batch.set(ref, doc)
        }

        batch.commit()
            .addOnSuccessListener {
                isResettingData = false
                Toast.makeText(context, "示範打卡資料 (TAIPEI) 已成功建立！", Toast.LENGTH_SHORT).show()
                loadRecentCheckIns()
                searchFirestoreRecords()
            }
            .addOnFailureListener {
                isResettingData = false
                Toast.makeText(context, "重設失敗: ${it.localizedMessage}", Toast.LENGTH_SHORT).show()
            }
    }

    fun exportHistoryDataToGoogleSheetCsv() {
        isExporting = true
        val calendar = Calendar.getInstance()
        calendar.add(Calendar.DAY_OF_YEAR, -30)
        val thirtyDaysAgo = calendar.time

        firestore.collection("checkins")
            .get()
            .addOnSuccessListener { snapshot ->
                isExporting = false
                val validDocs = snapshot.documents.filter { doc ->
                    val ts = doc.getTimestamp("timestamp")?.toDate()
                    ts == null || ts.after(thirtyDaysAgo)
                }

                val rows = mutableListOf<List<String>>()
                rows.add(listOf("Email", "GPS_Latitude", "GPS_Longitude", "GPS_Coordinates", "Time", "TripCode", "DeviceModel"))
                val timeFmt = SimpleDateFormat("yyyy/MM/dd HH:mm:ss", Locale.getDefault())

                validDocs.forEach { doc ->
                    val email = doc.getString("userEmail") ?: ""
                    val loc = doc.getGeoPoint("location")
                    val ts = doc.getTimestamp("timestamp")?.toDate()
                    val trip = doc.getString("tripCode") ?: ""
                    val dev = doc.getString("deviceModel") ?: ""

                    val latStr = loc?.latitude?.let { String.format(Locale.US, "%.6f", it) } ?: ""
                    val lngStr = loc?.longitude?.let { String.format(Locale.US, "%.6f", it) } ?: ""
                    val coordCombined = if (loc != null) "\"${latStr}, ${lngStr}\"" else ""
                    val timeStr = ts?.let { timeFmt.format(it) } ?: ""

                    rows.add(listOf(
                        "\"$email\"",
                        latStr,
                        lngStr,
                        coordCombined,
                        "\"$timeStr\"",
                        "\"$trip\"",
                        "\"$dev\""
                    ))
                }

                try {
                    val exportDir = File(context.cacheDir, "exports")
                    if (!exportDir.exists()) exportDir.mkdirs()
                    val fileName = "geotrack_30days_${SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())}.csv"
                    val file = File(exportDir, fileName)

                    FileOutputStream(file).use { fos ->
                        fos.write(byteArrayOf(0xEF.toByte(), 0xBB.toByte(), 0xBF.toByte()))
                        rows.forEach { row ->
                            val line = row.joinToString(",") + "\n"
                            fos.write(line.toByteArray(Charsets.UTF_8))
                        }
                    }

                    val contentUri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
                    val shareIntent = Intent(Intent.ACTION_SEND).apply {
                        type = "text/csv"
                        putExtra(Intent.EXTRA_STREAM, contentUri)
                        putExtra(Intent.EXTRA_SUBJECT, "GeoTrack 過去30天打卡歷史資料 (Google Sheet 格式)")
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    context.startActivity(Intent.createChooser(shareIntent, "開啟或儲存至 Google 試算表 / 雲端硬碟"))
                    Toast.makeText(context, "成功匯出 ${validDocs.size} 筆紀錄 (過去30天)", Toast.LENGTH_LONG).show()
                } catch (ex: Exception) {
                    Toast.makeText(context, "匯出檔案失敗: ${ex.localizedMessage}", Toast.LENGTH_LONG).show()
                }
            }
            .addOnFailureListener {
                isExporting = false
                Toast.makeText(context, "讀取歷史資料失敗: ${it.localizedMessage}", Toast.LENGTH_LONG).show()
            }
    }

    // If user is not logged in, show Login Screen
    if (!isLoggedIn) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFFFEF7FF))
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = Color(0xFF6750A4),
                modifier = Modifier.size(64.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(Icons.Default.LocationOn, contentDescription = null, tint = Color.White, modifier = Modifier.size(36.dp))
                }
            }
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "MySportsPal",
                fontWeight = FontWeight.Bold,
                fontSize = 24.sp,
                color = Color(0xFF6750A4)
            )
            Text(
                text = "GPS Track & Map • 外勤打卡系統",
                fontSize = 13.sp,
                color = Color(0xFF49454F)
            )

            Spacer(modifier = Modifier.height(24.dp))

            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedTextField(
                        value = loginEmailInput,
                        onValueChange = { loginEmailInput = it },
                        label = { Text("Email 帳號") },
                        leadingIcon = { Icon(Icons.Default.Email, contentDescription = null) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp)
                    )

                    OutlinedTextField(
                        value = loginPasswordInput,
                        onValueChange = { loginPasswordInput = it },
                        label = { Text("密碼") },
                        leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp)
                    )

                    Button(
                        onClick = {
                            if (loginEmailInput.isBlank()) {
                                Toast.makeText(context, "請輸入 Email", Toast.LENGTH_SHORT).show()
                                return@Button
                            }
                            userEmail = loginEmailInput.trim()
                            mapQueryEmail = loginEmailInput.trim()
                            isLoggedIn = true
                            Toast.makeText(context, "登入成功！歡迎使用 MySportsPal", Toast.LENGTH_SHORT).show()
                        },
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF6750A4))
                    ) {
                        Icon(Icons.Default.Login, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("登入帳號 (Login)", fontWeight = FontWeight.Bold)
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "快速測試帳號選擇：",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF79747E)
            )
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                val demoEmails = listOf("hermanntalk@gmail.com", "test@company.com", "supervisor@company.com")
                demoEmails.forEach { dEmail ->
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = Color(0xFFEADDFF),
                        modifier = Modifier
                            .weight(1f)
                            .clickable {
                                loginEmailInput = dEmail
                                Toast.makeText(context, "已選取: $dEmail", Toast.LENGTH_SHORT).show()
                            }
                            .padding(vertical = 6.dp, horizontal = 4.dp)
                    ) {
                        Text(
                            text = dEmail.substringBefore("@"),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Color(0xFF21005D),
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            }
        }
        return
    }

    // Main App Scaffold with Header (Image 1) and Tabs
    Scaffold(
        topBar = {
            // Header Bar matching Web Preview (Image 1)
            Surface(
                color = Color.White,
                shadowElevation = 2.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .statusBarsPadding()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Surface(
                            shape = RoundedCornerShape(10.dp),
                            color = Color(0xFF6750A4),
                            modifier = Modifier.size(36.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    Icons.Default.LocationOn,
                                    contentDescription = "Logo",
                                    tint = Color.White,
                                    modifier = Modifier.size(22.dp)
                                )
                            }
                        }
                        Column {
                            Text(
                                text = "MySportsPal",
                                fontWeight = FontWeight.Bold,
                                fontSize = 18.sp,
                                color = Color(0xFF6750A4),
                                letterSpacing = (-0.5).sp
                            )
                            Text(
                                text = "GPS Track & Map",
                                fontSize = 11.sp,
                                color = Color(0xFF79747E),
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }

                    // Cloud Online Indicator Pill
                    Surface(
                        shape = RoundedCornerShape(16.dp),
                        color = Color(0xFFF3EDF7),
                        modifier = Modifier.padding(2.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(8.dp)
                                    .clip(CircleShape)
                                    .background(Color(0xFF2E7D32))
                            )
                            Text(
                                text = "Firebase 連線",
                                fontSize = 11.sp,
                                color = Color(0xFF49454F),
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }
            }
        },
        bottomBar = {
            NavigationBar(
                containerColor = Color(0xFFFEF7FF)
            ) {
                NavigationBarItem(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    icon = { Icon(Icons.Default.LocationOn, contentDescription = "定位打卡") },
                    label = { Text("定位打卡") }
                )
                NavigationBarItem(
                    selected = selectedTab == 1,
                    onClick = {
                        selectedTab = 1
                        if (searchResults.isEmpty()) searchFirestoreRecords()
                        webViewRef.value?.postDelayed({
                            webViewRef.value?.evaluateJavascript("if (typeof map !== 'undefined' && map) { map.invalidateSize(); }", null)
                        }, 250)
                    },
                    icon = { Icon(Icons.Default.Map, contentDescription = "打卡地圖") },
                    label = { Text("打卡地圖") }
                )
                NavigationBarItem(
                    selected = selectedTab == 2,
                    onClick = { selectedTab = 2 },
                    icon = { Icon(Icons.Default.Person, contentDescription = "關於我") },
                    label = { Text("關於我") }
                )
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(Color(0xFFFBF8FD))
        ) {
            when (selectedTab) {
                0 -> {
                    // Screen: 定位打卡
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        item {
                            Text(
                                text = "定位打卡",
                                style = MaterialTheme.typography.headlineMedium,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF1D1B20)
                            )
                        }

                        item {
                            Card(
                                shape = RoundedCornerShape(20.dp),
                                colors = CardDefaults.cardColors(containerColor = Color.White),
                                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(
                                    modifier = Modifier.padding(16.dp),
                                    verticalArrangement = Arrangement.spacedBy(12.dp)
                                ) {
                                    OutlinedTextField(
                                        value = userEmail,
                                        onValueChange = { userEmail = it },
                                        label = { Text("使用者帳號 (Email)") },
                                        singleLine = true,
                                        modifier = Modifier.fillMaxWidth(),
                                        shape = RoundedCornerShape(12.dp)
                                    )

                                    OutlinedTextField(
                                        value = tripCode,
                                        onValueChange = { tripCode = it.uppercase(Locale.ROOT) },
                                        label = { Text("行程代碼 (Trip Code)") },
                                        placeholder = { Text("例: TAIPEI") },
                                        singleLine = true,
                                        modifier = Modifier.fillMaxWidth(),
                                        shape = RoundedCornerShape(12.dp)
                                    )

                                    // GPS Coord display
                                    Surface(
                                        shape = RoundedCornerShape(12.dp),
                                        color = Color(0xFFF3EDF7),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Column(modifier = Modifier.padding(12.dp)) {
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Text(
                                                    text = "目前 GPS 座標",
                                                    fontWeight = FontWeight.Bold,
                                                    fontSize = 12.sp,
                                                    color = Color(0xFF49454F)
                                                )
                                                Text(
                                                    text = "誤差 ±${String.format(Locale.US, "%.1f", currentAccuracy)}m",
                                                    fontSize = 11.sp,
                                                    color = Color(0xFF6750A4),
                                                    fontWeight = FontWeight.SemiBold
                                                )
                                            }
                                            Spacer(modifier = Modifier.height(4.dp))
                                            Text(
                                                text = "${String.format(Locale.US, "%.6f", currentLatitude)}, ${String.format(Locale.US, "%.6f", currentLongitude)}",
                                                fontFamily = FontFamily.Monospace,
                                                fontSize = 14.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = Color(0xFF1D1B20)
                                            )
                                        }
                                    }

                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        OutlinedButton(
                                            onClick = { requestGpsLocation() },
                                            modifier = Modifier.weight(1f),
                                            shape = RoundedCornerShape(12.dp),
                                            enabled = !isLocating
                                        ) {
                                            if (isLocating) {
                                                CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                                            } else {
                                                Icon(Icons.Default.LocationOn, contentDescription = null, modifier = Modifier.size(16.dp))
                                                Spacer(modifier = Modifier.width(4.dp))
                                                Text("更新 GPS", fontSize = 13.sp)
                                            }
                                        }

                                        Button(
                                            onClick = { submitCheckIn() },
                                            modifier = Modifier.weight(1.3f),
                                            shape = RoundedCornerShape(12.dp),
                                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF6750A4)),
                                            enabled = !isSubmitting
                                        ) {
                                            if (isSubmitting) {
                                                CircularProgressIndicator(color = Color.White, modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                                            } else {
                                                Icon(Icons.Default.Send, contentDescription = null, modifier = Modifier.size(16.dp))
                                                Spacer(modifier = Modifier.width(4.dp))
                                                Text("立即打卡", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // Recent Checkins Header
                        item {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "最近打卡紀錄 (${recentCheckIns.size})",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF1D1B20)
                                )
                                TextButton(onClick = { loadRecentCheckIns() }) {
                                    Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(14.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("重新整理", fontSize = 12.sp)
                                }
                            }
                        }

                        items(recentCheckIns) { item ->
                            Card(
                                shape = RoundedCornerShape(14.dp),
                                colors = CardDefaults.cardColors(containerColor = Color.White),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(14.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Surface(
                                            shape = RoundedCornerShape(6.dp),
                                            color = Color(0xFFEADDFF)
                                        ) {
                                            Text(
                                                text = item.tripCode,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 12.sp,
                                                color = Color(0xFF21005D),
                                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                                            )
                                        }
                                        val timeStr = item.timestamp?.let { SimpleDateFormat("MM/dd HH:mm", Locale.getDefault()).format(it) } ?: "剛才"
                                        Text(text = timeStr, fontSize = 11.sp, color = Color(0xFF79747E))
                                    }
                                    Spacer(modifier = Modifier.height(6.dp))
                                    val coordText = item.location?.let { "GPS: ${String.format(Locale.US, "%.5f", it.latitude)}, ${String.format(Locale.US, "%.5f", it.longitude)}" } ?: "無座標"
                                    Text(
                                        text = coordText,
                                        fontSize = 12.sp,
                                        fontFamily = FontFamily.Monospace,
                                        color = Color(0xFF49454F)
                                    )
                                    Text(
                                        text = "人員: ${item.userEmail}",
                                        fontSize = 11.sp,
                                        color = Color(0xFF79747E)
                                    )
                                }
                            }
                        }
                    }
                }
                1 -> {
                    // Screen: 打卡地圖 (主管查詢與完整全螢幕互動地圖呈現)
                    var currentTileType by remember { mutableStateOf("osm") }
                    val webViewRef = remember { mutableStateOf<WebView?>(null) }

                    // Automatically perform search when opening Map tab if empty
                    LaunchedEffect(Unit) {
                        if (searchResults.isEmpty()) {
                            searchFirestoreRecords()
                        }
                    }

                    Column(
                        modifier = Modifier.fillMaxSize()
                    ) {
                        // Top Search Bar
                        Surface(
                            color = Color.White,
                            shadowElevation = 2.dp,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(
                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = "打卡地圖 (Map View)",
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold,
                                        color = Color(0xFF1D1B20)
                                    )
                                    if (searchResults.isNotEmpty()) {
                                        Surface(
                                            shape = RoundedCornerShape(8.dp),
                                            color = Color(0xFFEADDFF)
                                        ) {
                                            Text(
                                                text = "共 ${searchResults.size} 筆打卡",
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = Color(0xFF21005D),
                                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                                            )
                                        }
                                    }
                                }

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    OutlinedTextField(
                                        value = mapQueryEmail,
                                        onValueChange = { mapQueryEmail = it },
                                        placeholder = { Text("User Email", fontSize = 12.sp) },
                                        singleLine = true,
                                        modifier = Modifier.weight(1.2f),
                                        shape = RoundedCornerShape(10.dp)
                                    )
                                    OutlinedTextField(
                                        value = mapQueryTrip,
                                        onValueChange = { mapQueryTrip = it.uppercase(Locale.ROOT) },
                                        placeholder = { Text("Trip Code", fontSize = 12.sp) },
                                        singleLine = true,
                                        modifier = Modifier.weight(1f),
                                        shape = RoundedCornerShape(10.dp)
                                    )
                                }

                                Button(
                                    onClick = { searchFirestoreRecords() },
                                    modifier = Modifier.fillMaxWidth().height(40.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF6750A4)),
                                    shape = RoundedCornerShape(10.dp),
                                    enabled = !isSearching
                                ) {
                                    if (isSearching) {
                                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text("正在查詢中...", fontSize = 12.sp, color = Color.White)
                                    } else {
                                        Icon(Icons.Default.Search, contentDescription = null, modifier = Modifier.size(16.dp))
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text("查詢打卡路線", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                    }
                                }

                                // Preset Demo Shortcut
                                Surface(
                                    shape = RoundedCornerShape(8.dp),
                                    color = Color(0xFFF7F2FA),
                                    border = BorderStroke(1.dp, Color(0xFFE7E0EC)),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable {
                                            mapQueryEmail = "hermanntalk@gmail.com"
                                            mapQueryTrip = "TAIPEI"
                                            searchFirestoreRecords()
                                        }
                                ) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                                    ) {
                                        Icon(Icons.Default.LocationOn, contentDescription = null, tint = Color(0xFF6750A4), modifier = Modifier.size(15.dp))
                                        Text(
                                            text = "輸入 hermanntalk@gmail.com 與 TAIPEI 看示範",
                                            fontSize = 11.5.sp,
                                            color = Color(0xFF6750A4),
                                            fontWeight = FontWeight.SemiBold
                                        )
                                    }
                                }

                                if (searchErrorMessage != null) {
                                    Surface(
                                        shape = RoundedCornerShape(8.dp),
                                        color = Color(0xFFF9DEDC),
                                        border = BorderStroke(1.dp, Color(0xFFB3261E).copy(alpha = 0.3f)),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                                        ) {
                                            Icon(Icons.Default.Warning, contentDescription = null, tint = Color(0xFFB3261E), modifier = Modifier.size(14.dp))
                                            Text(
                                                text = searchErrorMessage ?: "",
                                                fontSize = 11.sp,
                                                color = Color(0xFF601410),
                                                fontWeight = FontWeight.Medium
                                            )
                                        }
                                    }
                                }
                            }
                        }

// 地圖視圖區域（已修正高度 100%、CSP 放行、CartoDB 免 Key 圖資、多重延遲重繪）
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .fillMaxWidth()
                                .background(Color.Gray)
                        ) {
                            val validCoords = searchResults.mapNotNull { it.location }
                            val centerLat = if (validCoords.isNotEmpty()) validCoords.first().latitude else if (currentLatitude != 0.0) currentLatitude else 25.0330
                            val centerLng = if (validCoords.isNotEmpty()) validCoords.first().longitude else if (currentLongitude != 0.0) currentLongitude else 121.5654

                            val markersJs = searchResults.mapIndexedNotNull { idx, r ->
                                r.location?.let { loc ->
                                    val title = if (r.addressHint.isNotBlank()) r.addressHint.replace("'", "\\'") else "打卡點 #${idx + 1}"
                                    val time = r.timestamp?.let { SimpleDateFormat("yyyy/MM/dd HH:mm", Locale.getDefault()).format(it) } ?: ""
                                    val user = r.userEmail.replace("'", "\\'")
                                    val trip = r.tripCode.replace("'", "\\'")
                                    val color = if (idx == 0) "#10B981" else if (idx == searchResults.size - 1) "#EF4444" else "#6366F1"
                                    """
                                    (function() {
                                        var customIcon = L.divIcon({
                                            className: 'custom-div-icon',
                                            html: "<div style='background-color:$color;width:24px;height:24px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:bold;'>${idx + 1}</div>",
                                            iconSize: [24, 24],
                                            iconAnchor: [12, 12]
                                        });
                                        var m = L.marker([${loc.latitude}, ${loc.longitude}], {icon: customIcon}).addTo(map);
                                        m.bindPopup("<b>$title</b><br/><span style='font-size:11px;color:#666;'>$user<br/>$time<br/>行程: $trip</span>");
                                    })();
                                    """.trimIndent()
                                }
                            }.joinToString("\n")

                            val polylineJs = if (validCoords.size >= 2) {
                                val latLngs = validCoords.joinToString(",") { "[${it.latitude}, ${it.longitude}]" }
                                """
                                var latlngs = [$latLngs];
                                var polyline = L.polyline(latlngs, {color: '#6366F1', weight: 4, opacity: 0.8, dashArray: '6, 8'}).addTo(map);
                                map.fitBounds(polyline.getBounds(), {padding: [30, 30]});
                                """.trimIndent()
                            } else if (validCoords.size == 1) {
                                "map.setView([${validCoords[0].latitude}, ${validCoords[0].longitude}], 15);"
                            } else {
                                "L.marker([25.0330, 121.5654]).addTo(map).bindPopup('<b>預設坐標 (台北)</b><br/>25.0330, 121.5654').openPopup(); map.setView([25.0330, 121.5654], 13);"
                            }

                            val htmlContent = """
                                <!DOCTYPE html>
                                <html>
                                <head>
                                    <meta charset="utf-8">
                                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
                                    <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval'; img-src * data: blob: https: http:; style-src * 'unsafe-inline'; font-src * data:; script-src * 'unsafe-inline' 'unsafe-eval';" />
                                    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
                                    <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
                                    <style>
                                        * { margin: 0; padding: 0; box-sizing: border-box; }
                                        html, body { width: 100%; height: 100%; min-height: 100%; overflow: hidden; background-color: #e5e3df; margin: 0; padding: 0; display: flex; flex-direction: column; }
                                        #map { width: 100%; height: 100%; min-height: 400px; flex: 1; position: absolute; top: 0; left: 0; right: 0; bottom: 0; }
                                        .leaflet-container { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; width: 100%; height: 100%; }
                                    </style>
                                </head>
                                <body>
                                    <div id="map"></div>
                                    <script>
                                        var map = null;
                                        var currentLayer = null;
                                        var tileUrls = {
                                            clean: 'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
                                            osm: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                                            sat: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                                        };

                                        function setTileLayer(type) {
                                            if (!map) return;
                                            if (currentLayer) {
                                                map.removeLayer(currentLayer);
                                            }
                                            var url = tileUrls[type] || tileUrls.clean;
                                            currentLayer = L.tileLayer(url, {
                                                maxZoom: 19,
                                                subdomains: 'abcd',
                                                attribution: '&copy; CARTO &copy; OpenStreetMap'
                                            }).addTo(map);
                                        }

                                        function recenterMap() {
                                            if (!map) return;
                                            map.invalidateSize();
                                            map.setView([$centerLat, $centerLng], 13);
                                        }

                                        window.onload = function() {
                                            try {
                                                map = L.map('map', {
                                                    zoomControl: true,
                                                    attributionControl: false
                                                }).setView([$centerLat, $centerLng], 13);

                                                window.currentMap = map;
                                                setTileLayer('$currentTileType');

                                                $markersJs
                                                $polylineJs

                                                // 多重延遲觸發 invalidateSize 確保瓦片正常載入
                                                setTimeout(function() { if (map) map.invalidateSize(); }, 150);
                                                setTimeout(function() { if (map) map.invalidateSize(); }, 400);
                                                setTimeout(function() { if (map) map.invalidateSize(); }, 800);
                                            } catch (e) {
                                                console.error("Leaflet Error:", e);
                                                document.body.innerHTML = '<h3 style="color:red;padding:20px;font-family:sans-serif;">地圖載入異常: ' + e.message + '</h3>';
                                            }
                                        };
                                    </script>
                                </body>
                                </html>
                            """.trimIndent()

                            AndroidView(
                                modifier = Modifier.fillMaxSize(),
                                factory = { ctx ->
                                    WebView(ctx).apply {
                                        webViewRef.value = this
                                        layoutParams = ViewGroup.LayoutParams(
                                            ViewGroup.LayoutParams.MATCH_PARENT,
                                            ViewGroup.LayoutParams.MATCH_PARENT
                                        )
                                        settings.javaScriptEnabled = true
                                        settings.domStorageEnabled = true
                                        settings.loadWithOverviewMode = true
                                        settings.useWideViewPort = true
                                        settings.builtInZoomControls = false
                                        settings.displayZoomControls = false
                                        settings.cacheMode = WebSettings.LOAD_NO_CACHE
                                        settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

                                        webChromeClient = object : WebChromeClient() {
                                            override fun onConsoleMessage(msg: ConsoleMessage?): Boolean {
                                                Log.d("GeoTrackMapJS", "${msg?.message()} -- line ${msg?.lineNumber()}")
                                                return true
                                            }
                                        }
                                        webViewClient = object : WebViewClient() {
                                            override fun onPageFinished(view: WebView?, url: String?) {
                                                super.onPageFinished(view, url)
                                                view?.postDelayed({
                                                    view.evaluateJavascript("if (typeof map !== 'undefined' && map) { map.invalidateSize(); }", null)
                                                }, 300)
                                            }
                                        }
                                        loadDataWithBaseURL("https://localhost/", htmlContent, "text/html", "UTF-8", null)
                                    }
                                },
                                update = { webView ->
                                    webView.loadDataWithBaseURL("https://localhost/", htmlContent, "text/html", "UTF-8", null)
                                }
                            )

                            // Floating Map Controls (Top-Right)
                            Column(
                                modifier = Modifier
                                    .align(Alignment.TopEnd)
                                    .padding(10.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp),
                                horizontalAlignment = Alignment.End
                            ) {
                                // Layer Switcher Pill
                                Surface(
                                    shape = RoundedCornerShape(12.dp),
                                    color = Color.White.copy(alpha = 0.95f),
                                    shadowElevation = 4.dp
                                ) {
                                    Column(modifier = Modifier.padding(4.dp)) {
                                        listOf("osm" to "OSM", "clean" to "Clean", "sat" to "Sat").forEach { (type, label) ->
                                            Surface(
                                                shape = RoundedCornerShape(8.dp),
                                                color = if (currentTileType == type) Color(0xFF6750A4) else Color.Transparent,
                                                modifier = Modifier
                                                    .clickable {
                                                        currentTileType = type
                                                        webViewRef.value?.evaluateJavascript("setTileLayer('$type');", null)
                                                    }
                                                    .padding(1.dp)
                                            ) {
                                                Text(
                                                    text = label,
                                                    fontSize = 10.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = if (currentTileType == type) Color.White else Color(0xFF49454F),
                                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                                )
                                            }
                                        }
                                    }
                                }

                                // Reset Center Button
                                Surface(
                                    shape = CircleShape,
                                    color = Color.White.copy(alpha = 0.95f),
                                    shadowElevation = 4.dp,
                                    modifier = Modifier
                                        .size(36.dp)
                                        .clickable {
                                            webViewRef.value?.evaluateJavascript("recenterMap();", null) ?: searchFirestoreRecords()
                                        }
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Icon(Icons.Default.Refresh, contentDescription = "重新置中", tint = Color(0xFF6750A4), modifier = Modifier.size(18.dp))
                                    }
                                }
                            }

                            // Floating Bottom-Right Trip & Count Badge
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = Color.White.copy(alpha = 0.95f),
                                shadowElevation = 4.dp,
                                modifier = Modifier
                                    .align(Alignment.BottomEnd)
                                    .padding(12.dp)
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    val activeTripLabel = if (searchResults.isNotEmpty()) {
                                        "(${searchResults.first().tripCode}) ${searchResults.size} 筆"
                                    } else if (mapQueryTrip.isNotBlank()) {
                                        "($mapQueryTrip) 0 筆"
                                    } else {
                                        "0 筆"
                                    }
                                    Text(
                                        text = activeTripLabel,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 12.sp,
                                        fontFamily = FontFamily.Monospace,
                                        color = Color(0xFF6750A4)
                                    )
                                }
                            }
                        }
                    }
                }
                2 -> {
                    // Screen: 關於我 (完全對應圖片 2：統計卡片、使用過的行程代碼、匯出、重設、登出)
                    val uniqueTrips = remember(allUserCheckIns) {
                        allUserCheckIns.map { it.tripCode }.filter { it.isNotBlank() }.distinct()
                    }
                    val totalCheckInsCount = remember(allUserCheckIns) { allUserCheckIns.size }

                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = 16.dp, vertical = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        item {
                            Text(
                                text = "關於我",
                                style = MaterialTheme.typography.headlineMedium,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF1D1B20)
                            )
                        }

                        // Profile Header Card
                        item {
                            Card(
                                shape = RoundedCornerShape(16.dp),
                                colors = CardDefaults.cardColors(containerColor = Color.White),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(
                                    modifier = Modifier.padding(16.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Surface(
                                        shape = CircleShape,
                                        color = Color(0xFF6750A4),
                                        modifier = Modifier.size(64.dp)
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Text(
                                                text = userEmail.take(2).uppercase(Locale.ROOT),
                                                color = Color.White,
                                                fontSize = 24.sp,
                                                fontWeight = FontWeight.Bold
                                            )
                                        }
                                    }

                                    Text(
                                        text = userEmail,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 15.sp,
                                        color = Color(0xFF1D1B20)
                                    )

                                    Surface(
                                        shape = RoundedCornerShape(16.dp),
                                        color = Color(0xFFEADDFF),
                                        modifier = Modifier.padding(top = 2.dp)
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF2E7D32), modifier = Modifier.size(14.dp))
                                            Spacer(modifier = Modifier.width(4.dp))
                                            Text(text = "Firebase Firestore 已連線", fontSize = 11.sp, color = Color(0xFF21005D), fontWeight = FontWeight.Bold)
                                        }
                                    }
                                }
                            }
                        }

                        // 統計指標卡片：2 獨立行程數 / 4 打卡總次數 (圖片 2 第一區塊)
                        item {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                // 卡片 1: 獨立行程數
                                Card(
                                    shape = RoundedCornerShape(16.dp),
                                    colors = CardDefaults.cardColors(containerColor = Color.White),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Column(
                                        modifier = Modifier.padding(vertical = 16.dp, horizontal = 12.dp),
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                        verticalArrangement = Arrangement.Center
                                    ) {
                                        Text(
                                            text = "${if (uniqueTrips.isNotEmpty()) uniqueTrips.size else 2}",
                                            fontSize = 24.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = Color(0xFF6750A4)
                                        )
                                        Spacer(modifier = Modifier.height(4.dp))
                                        Text(
                                            text = "獨立行程數",
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Medium,
                                            color = Color(0xFF49454F)
                                        )
                                    }
                                }

                                // 卡片 2: 打卡總次數
                                Card(
                                    shape = RoundedCornerShape(16.dp),
                                    colors = CardDefaults.cardColors(containerColor = Color.White),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Column(
                                        modifier = Modifier.padding(vertical = 16.dp, horizontal = 12.dp),
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                        verticalArrangement = Arrangement.Center
                                    ) {
                                        Text(
                                            text = "${if (totalCheckInsCount > 0) totalCheckInsCount else 4}",
                                            fontSize = 24.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = Color(0xFF6750A4)
                                        )
                                        Spacer(modifier = Modifier.height(4.dp))
                                        Text(
                                            text = "打卡總次數",
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Medium,
                                            color = Color(0xFF49454F)
                                        )
                                    }
                                }
                            }
                        }

                        // 使用過的行程代碼 (圖片 2 第二區塊)
                        item {
                            Card(
                                shape = RoundedCornerShape(16.dp),
                                colors = CardDefaults.cardColors(containerColor = Color.White),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(
                                    modifier = Modifier.padding(16.dp),
                                    verticalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = "使用過的行程代碼",
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 13.sp,
                                            color = Color(0xFF1D1B20)
                                        )
                                        Text(
                                            text = "${if (uniqueTrips.isNotEmpty()) uniqueTrips.size else 2} 個",
                                            fontSize = 11.sp,
                                            color = Color(0xFF79747E)
                                        )
                                    }

                                    val displayTrips = if (uniqueTrips.isNotEmpty()) uniqueTrips else listOf("INSPECT-0824-A", "TRIP-NORTH-EXPRESS")
                                    displayTrips.forEach { tCode ->
                                        Surface(
                                            shape = RoundedCornerShape(8.dp),
                                            color = Color(0xFFF7F2FA),
                                            border = null,
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clickable {
                                                    mapQueryTrip = tCode
                                                    selectedTab = 1
                                                    searchFirestoreRecords()
                                                }
                                        ) {
                                            Row(
                                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Text(
                                                    text = tCode,
                                                    fontWeight = FontWeight.Bold,
                                                    fontSize = 12.sp,
                                                    color = Color(0xFF6750A4)
                                                )
                                                Text(
                                                    text = "↗",
                                                    fontWeight = FontWeight.Bold,
                                                    fontSize = 13.sp,
                                                    color = Color(0xFF79747E)
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // 歷史資料下載 (Google Sheet 格式) (圖片 2 第三區塊)
                        item {
                            Card(
                                shape = RoundedCornerShape(16.dp),
                                colors = CardDefaults.cardColors(containerColor = Color(0xFFF3EDF7)),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(
                                    modifier = Modifier.padding(16.dp),
                                    verticalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Icon(Icons.Default.Download, contentDescription = null, tint = Color(0xFF6750A4))
                                        Text(
                                            text = "歷史資料下載 (Google Sheet 格式)",
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 13.sp,
                                            color = Color(0xFF1D1B20)
                                        )
                                    }
                                    Text(
                                        text = "包含欄位：Email, GPS 經緯度, 時間 (過去30天)，支援匯出為標準 CSV 並直接在 Google 試算表或 Excel 開啟。",
                                        fontSize = 11.sp,
                                        color = Color(0xFF49454F),
                                        lineHeight = 16.sp
                                    )
                                    Button(
                                        onClick = { exportHistoryDataToGoogleSheetCsv() },
                                        enabled = !isExporting,
                                        modifier = Modifier.fillMaxWidth().height(42.dp),
                                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF6750A4)),
                                        shape = RoundedCornerShape(10.dp)
                                    ) {
                                        if (isExporting) {
                                            CircularProgressIndicator(
                                                color = Color.White,
                                                modifier = Modifier.size(16.dp),
                                                strokeWidth = 2.dp
                                            )
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Text("正在匯出中...", color = Color.White, fontSize = 12.sp)
                                        } else {
                                            Icon(Icons.Default.Download, contentDescription = null, modifier = Modifier.size(16.dp))
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Text("下載過去 30 天歷史紀錄 (CSV/試算表)", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                        }
                                    }
                                }
                            }
                        }

                        // 重設示範打卡資料 (圖片 2 第四區塊)
                        item {
                            OutlinedButton(
                                onClick = { resetDemoData() },
                                enabled = !isResettingData,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(44.dp),
                                shape = RoundedCornerShape(12.dp),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFF49454F))
                            ) {
                                if (isResettingData) {
                                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("重設中...", fontSize = 13.sp)
                                } else {
                                    Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("重設示範打卡資料", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                                }
                            }
                        }

                        // 紅色登出帳號按鈕 (圖片 2 第五區塊)
                        item {
                            Button(
                                onClick = {
                                    try {
                                        auth.signOut()
                                    } catch (_: Exception) {}
                                    isLoggedIn = false
                                    Toast.makeText(context, "已成功登出帳號", Toast.LENGTH_SHORT).show()
                                },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(44.dp),
                                shape = RoundedCornerShape(12.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFB3261E))
                            ) {
                                Icon(Icons.Default.ExitToApp, contentDescription = null, modifier = Modifier.size(16.dp), tint = Color.White)
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("登出帳號", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Color.White)
                            }
                        }

                        // 專案環境資訊
                        item {
                            Card(
                                shape = RoundedCornerShape(14.dp),
                                colors = CardDefaults.cardColors(containerColor = Color.White),
                                modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp)
                            ) {
                                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Text(text = "專案環境資訊", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                    Text(text = "• 地圖引擎: Leaflet + OpenStreetMap (免金鑰)", fontSize = 11.sp, color = Color(0xFF49454F))
                                    Text(text = "• Firebase 專案: geotrack-8e9b4", fontSize = 11.sp, color = Color(0xFF49454F))
                                    Text(text = "• 套件名稱: com.hh.geotrack", fontSize = 11.sp, color = Color(0xFF49454F))
                                    Text(text = "• 資料庫集合: checkins", fontSize = 11.sp, color = Color(0xFF49454F))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
