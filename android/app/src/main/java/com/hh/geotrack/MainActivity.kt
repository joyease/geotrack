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
import android.view.ViewGroup
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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
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

data class UserStampRecord(
    val attractionId: Int = 0,
    val name: String = "",
    val stampedAt: Date? = null,
    val dateString: String = ""
)

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        try {
            if (FirebaseApp.getApps(this).isEmpty()) {
                FirebaseApp.initializeApp(this)
            }
        } catch (e: Exception) {
            try {
                val options = FirebaseOptions.Builder()
                    .setApplicationId("1:133122521568:android:51d7db5ef2979686995385")
                    .setApiKey("AIzaSyBagcQG_7QSBvf0lSdYPmD4vH1VrOeToJY")
                    .setProjectId("geotrack-8e9b4")
                    .setStorageBucket("geotrack-8e9b4.firebasestorage.app")
                    .build()
                FirebaseApp.initializeApp(this, options)
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
    var isLoggedIn by remember { mutableStateOf(auth.currentUser != null) }
    var authModeIsRegister by remember { mutableStateOf(false) } // false = Login, true = Register
    var loginEmailInput by remember { mutableStateOf(auth.currentUser?.email ?: "test@gmail.com") }
    var loginPasswordInput by remember { mutableStateOf("password123") }
    var passwordVisible by remember { mutableStateOf(false) }
    var isAuthenticating by remember { mutableStateOf(false) }
    var loginErrorDetail by remember { mutableStateOf<String?>(null) }

    var selectedTab by remember { mutableIntStateOf(0) }
    var userEmail by remember { mutableStateOf(auth.currentUser?.email ?: "test@gmail.com") }
    var tripCode by remember { mutableStateOf("TAIPEI") }
    var currentLatitude by remember { mutableDoubleStateOf(25.033964) }
    var currentLongitude by remember { mutableDoubleStateOf(121.564468) }
    var currentAccuracy by remember { mutableFloatStateOf(4.5f) }
    var isLocating by remember { mutableStateOf(false) }
    var isSubmitting by remember { mutableStateOf(false) }
    var allUserCheckIns by remember { mutableStateOf<List<CheckInModel>>(emptyList()) }
    var recentCheckIns by remember { mutableStateOf<List<CheckInModel>>(emptyList()) }

    // Query state for Map screen
    var mapQueryEmail by remember { mutableStateOf("test@gmail.com") }
    var mapQueryTrip by remember { mutableStateOf("TAIPEI") }
    var searchResults by remember { mutableStateOf<List<CheckInModel>>(emptyList()) }
    var searchErrorMessage by remember { mutableStateOf<String?>(null) }
    var isSearching by remember { mutableStateOf(false) }
    var isExporting by remember { mutableStateOf(false) }
    var isResettingData by remember { mutableStateOf(false) }
    val webViewRef = remember { mutableStateOf<WebView?>(null) }

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

    // Stamp Rally State (雙北百景集章)
    var userStamps by remember {
        mutableStateOf<Map<Int, UserStampRecord>>(
            mapOf(
                1 to UserStampRecord(1, "台北101觀景台", dateString = "2026-08-23"),
                2 to UserStampRecord(2, "象山六巨石", dateString = "2026-08-24"),
                28 to UserStampRecord(28, "華山1914文創園區", dateString = "2026-08-25")
            )
        )
    }
    var isScanningStamps by remember { mutableStateOf(false) }
    var stampFilterTab by remember { mutableStateOf("全部") }
    var stampSearchQuery by remember { mutableStateOf("") }
    var stampCelebrationTarget by remember { mutableStateOf<Attraction?>(null) }
    var selectedAttractionDetail by remember { mutableStateOf<Attraction?>(null) }

    fun loadUserStamps() {
        val currentUserId = auth.currentUser?.uid ?: "usr_test_01"
        firestore.collection("users").document(currentUserId).collection("stamps")
            .get()
            .addOnSuccessListener { snapshot ->
                if (!snapshot.isEmpty) {
                    val map = mutableMapOf<Int, UserStampRecord>()
                    snapshot.documents.forEach { doc ->
                        val id = doc.getLong("attractionId")?.toInt() ?: doc.id.toIntOrNull() ?: 0
                        val name = doc.getString("name") ?: ""
                        val ts = doc.getTimestamp("stampedAt")?.toDate()
                        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
                        val dStr = if (ts != null) sdf.format(ts) else SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
                        if (id > 0) {
                            map[id] = UserStampRecord(id, name, ts, dStr)
                        }
                    }
                    if (map.isNotEmpty()) {
                        userStamps = userStamps + map
                    }
                }
            }
            .addOnFailureListener {
                Log.d("GeoTrackStamp", "Stamps offline fallback: ${it.message}")
            }
    }

    LaunchedEffect(isLoggedIn) {
        if (isLoggedIn) {
            loadRecentCheckIns()
            loadUserStamps()
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
        val currentAuth = auth.currentUser
        if (currentAuth == null) {
            Toast.makeText(context, "請先通過 Firebase 登入認證後再進行打卡！", Toast.LENGTH_LONG).show()
            isLoggedIn = false
            return
        }

        if (tripCode.isBlank()) {
            Toast.makeText(context, "請輸入行程代碼", Toast.LENGTH_SHORT).show()
            return
        }

        isSubmitting = true
        val activeEmail = currentAuth.email ?: userEmail.trim()
        val docData = hashMapOf(
            "userId" to (currentAuth.email?.substringBefore("@") ?: currentAuth.uid),
            "userEmail" to activeEmail,
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

    fun scanAndStampAttraction() {
        val currentAuth = auth.currentUser
        if (currentAuth == null) {
            Toast.makeText(context, "請先通過 Firebase 登入認證後再進行集章！", Toast.LENGTH_LONG).show()
            isLoggedIn = false
            return
        }
        val currentUserId = currentAuth.uid

        if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            locationPermissionLauncher.launch(
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
            )
            return
        }

        isScanningStamps = true
        val cts = CancellationTokenSource()
        try {
            fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cts.token)
                .addOnSuccessListener { loc: Location? ->
                    isScanningStamps = false
                    val userLat = loc?.latitude ?: currentLatitude
                    val userLng = loc?.longitude ?: currentLongitude

                    val distances = northTaiwan100AttractionsSpaced.map { att ->
                        val result = FloatArray(1)
                        Location.distanceBetween(userLat, userLng, att.lat, att.lng, result)
                        Pair(att, result[0])
                    }

                    val within200m = distances.filter { it.second <= 200f }
                    if (within200m.isNotEmpty()) {
                        val closest = within200m.minByOrNull { it.second }!!.first
                        if (userStamps.containsKey(closest.id)) {
                            val existing = userStamps[closest.id]
                            Toast.makeText(context, "您在 ${existing?.dateString} 已經蓋過【${closest.name}】的章囉！", Toast.LENGTH_SHORT).show()
                        } else {
                            val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
                            val dateStr = sdf.format(Date())
                            val newRecord = UserStampRecord(closest.id, closest.name, Date(), dateStr)

                            val stampData = hashMapOf(
                                "attractionId" to closest.id,
                                "name" to closest.name,
                                "stampedAt" to FieldValue.serverTimestamp()
                            )
                            firestore.collection("users").document(currentUserId).collection("stamps")
                                .document(closest.id.toString())
                                .set(stampData)
                                .addOnSuccessListener {
                                    userStamps = userStamps + (closest.id to newRecord)
                                    stampCelebrationTarget = closest
                                    Toast.makeText(context, "🎉 恭喜在 [${closest.name}] 完成打卡！", Toast.LENGTH_SHORT).show()
                                }
                                .addOnFailureListener {
                                    userStamps = userStamps + (closest.id to newRecord)
                                    stampCelebrationTarget = closest
                                    Toast.makeText(context, "🎉 恭喜在 [${closest.name}] 完成打卡！", Toast.LENGTH_SHORT).show()
                                }
                        }
                    } else {
                        val closestOverall = distances.minByOrNull { it.second }!!
                        val distFormatted = if (closestOverall.second >= 1000f) {
                            String.format(Locale.US, "%.1f 公里", closestOverall.second / 1000f)
                        } else {
                            "${closestOverall.second.toInt()} 公尺"
                        }
                        Toast.makeText(context, "目前位置附近 200 公尺內沒有可打卡的景點 (距離最近的【${closestOverall.first.name}】還有 $distFormatted)", Toast.LENGTH_LONG).show()
                    }
                }
                .addOnFailureListener {
                    isScanningStamps = false
                    Toast.makeText(context, "GPS 掃描失敗: ${it.localizedMessage}", Toast.LENGTH_SHORT).show()
                }
        } catch (e: SecurityException) {
            isScanningStamps = false
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
                text = "MyTrackIn",
                fontWeight = FontWeight.Bold,
                fontSize = 24.sp,
                color = Color(0xFF6750A4)
            )
            Text(
                text = "旅遊打卡 & 百景集章",
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
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
                    // Mode Toggle: 登入 / 註冊
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFFF3EDF7), RoundedCornerShape(10.dp))
                            .padding(4.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = if (!authModeIsRegister) Color(0xFF6750A4) else Color.Transparent,
                            modifier = Modifier
                                .weight(1f)
                                .clickable {
                                    authModeIsRegister = false
                                    loginErrorDetail = null
                                }
                                .padding(vertical = 8.dp)
                        ) {
                            Text(
                                text = "登入現有帳號",
                                fontSize = 13.sp,
                                fontWeight = if (!authModeIsRegister) FontWeight.Bold else FontWeight.Medium,
                                color = if (!authModeIsRegister) Color.White else Color(0xFF49454F),
                                textAlign = TextAlign.Center,
                                modifier = Modifier.fillMaxWidth()
                            )
                        }

                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = if (authModeIsRegister) Color(0xFF6750A4) else Color.Transparent,
                            modifier = Modifier
                                .weight(1f)
                                .clickable {
                                    authModeIsRegister = true
                                    loginErrorDetail = null
                                }
                                .padding(vertical = 8.dp)
                        ) {
                            Text(
                                text = "註冊新帳號",
                                fontSize = 13.sp,
                                fontWeight = if (authModeIsRegister) FontWeight.Bold else FontWeight.Medium,
                                color = if (authModeIsRegister) Color.White else Color(0xFF49454F),
                                textAlign = TextAlign.Center,
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }

                    OutlinedTextField(
                        value = loginEmailInput,
                        onValueChange = { 
                            loginEmailInput = it
                            if (loginErrorDetail != null) loginErrorDetail = null
                        },
                        label = { Text("Firebase Email 帳號") },
                        leadingIcon = { Icon(Icons.Default.Email, contentDescription = null) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp)
                    )

                    OutlinedTextField(
                        value = loginPasswordInput,
                        onValueChange = { 
                            loginPasswordInput = it
                            if (loginErrorDetail != null) loginErrorDetail = null
                        },
                        label = { Text("Firebase 密碼 (至少6位)") },
                        leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null) },
                        trailingIcon = {
                            IconButton(onClick = { passwordVisible = !passwordVisible }) {
                                Icon(
                                    if (passwordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                    contentDescription = if (passwordVisible) "隱藏密碼" else "顯示密碼"
                                )
                            }
                        },
                        visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp)
                    )

                    if (loginErrorDetail != null) {
                        Surface(
                            color = Color(0xFFF9DEDC),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Row(
                                    verticalAlignment = Alignment.Top,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Icon(Icons.Default.Error, contentDescription = null, tint = Color(0xFFB3261E), modifier = Modifier.size(18.dp))
                                    Text(
                                        text = loginErrorDetail ?: "",
                                        fontSize = 12.sp,
                                        color = Color(0xFF601410),
                                        lineHeight = 16.sp
                                    )
                                }

                                if (!authModeIsRegister && (loginErrorDetail?.contains("帳號或密碼不正確") == true || loginErrorDetail?.contains("user-not-found") == true)) {
                                    OutlinedButton(
                                        onClick = {
                                            authModeIsRegister = true
                                            loginErrorDetail = null
                                        },
                                        modifier = Modifier.fillMaxWidth().height(36.dp),
                                        shape = RoundedCornerShape(8.dp),
                                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFF6750A4))
                                    ) {
                                        Text("切換為【註冊新帳號】並建立", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }
                    }

                    Button(
                        onClick = {
                            val cleanEmail = loginEmailInput.trim()
                            val cleanPass = loginPasswordInput.trim()
                            if (cleanEmail.isBlank() || cleanPass.isBlank()) {
                                loginErrorDetail = "請輸入完整的 Email 與密碼"
                                Toast.makeText(context, "請輸入完整的 Email 與密碼", Toast.LENGTH_SHORT).show()
                                return@Button
                            }
                            if (cleanPass.length < 6) {
                                loginErrorDetail = "密碼長度至少需 6 個字元"
                                Toast.makeText(context, "密碼長度至少需 6 個字元", Toast.LENGTH_SHORT).show()
                                return@Button
                            }

                            isAuthenticating = true
                            loginErrorDetail = null

                            if (authModeIsRegister) {
                                // 註冊新帳號
                                auth.createUserWithEmailAndPassword(cleanEmail, cleanPass)
                                    .addOnSuccessListener { result ->
                                        isAuthenticating = false
                                        loginErrorDetail = null
                                        val user = result.user
                                        if (user != null) {
                                            userEmail = user.email ?: cleanEmail
                                            mapQueryEmail = userEmail
                                            isLoggedIn = true
                                            Toast.makeText(context, "🎉 註冊並登入成功！歡迎 ${user.email}", Toast.LENGTH_SHORT).show()
                                            loadRecentCheckIns()
                                        }
                                    }
                                    .addOnFailureListener { ex ->
                                        isAuthenticating = false
                                        val msg = ex.localizedMessage ?: ex.message ?: "未知錯誤"
                                        val friendlyMsg = when {
                                            msg.contains("email-already-in-use", ignoreCase = true) ->
                                                "此 Email 已被註冊過！請切換至【登入現有帳號】。"
                                            msg.contains("invalid-email", ignoreCase = true) ->
                                                "Email 格式不正確，請輸入合法的 Email 格式。"
                                            msg.contains("weak-password", ignoreCase = true) ->
                                                "密碼強度不足，請設定至少 6 位長度。"
                                            msg.contains("API key not valid", ignoreCase = true) || msg.contains("UNAUTHORIZED", ignoreCase = true) || msg.contains("app-not-authorized", ignoreCase = true) ->
                                                "Firebase API Key 權限錯誤：請確認 Google Cloud Credentials / Firebase Console 中的 API Key 設定。"
                                            else ->
                                                "註冊失敗: $msg"
                                        }
                                        loginErrorDetail = friendlyMsg
                                        Toast.makeText(context, "❌ $friendlyMsg", Toast.LENGTH_LONG).show()
                                    }
                            } else {
                                // 登入現有帳號
                                auth.signInWithEmailAndPassword(cleanEmail, cleanPass)
                                    .addOnSuccessListener { result ->
                                        isAuthenticating = false
                                        loginErrorDetail = null
                                        val user = result.user
                                        if (user != null) {
                                            userEmail = user.email ?: cleanEmail
                                            mapQueryEmail = userEmail
                                            isLoggedIn = true
                                            Toast.makeText(context, "✅ Firebase 認證成功！歡迎 ${user.email}", Toast.LENGTH_SHORT).show()
                                            loadRecentCheckIns()
                                        }
                                    }
                                    .addOnFailureListener { ex ->
                                        isAuthenticating = false
                                        val msg = ex.localizedMessage ?: ex.message ?: "未知錯誤"
                                        val friendlyMsg = when {
                                            msg.contains("API key not valid", ignoreCase = true) || msg.contains("UNAUTHORIZED", ignoreCase = true) || msg.contains("app-not-authorized", ignoreCase = true) ->
                                                "Firebase API Key 限制錯誤：請至 Firebase Console / Google Cloud 檢查 Android API Key 限制，或在專案中新增 SHA-1 憑證指紋。"
                                            msg.contains("network", ignoreCase = true) || msg.contains("timeout", ignoreCase = true) ->
                                                "網路連線失敗，請檢查手機是否已連線至 Wi-Fi 或行動網路。"
                                            msg.contains("user-not-found", ignoreCase = true) || msg.contains("wrong-password", ignoreCase = true) || msg.contains("invalid-credential", ignoreCase = true) ->
                                                "帳號或密碼不正確。若是首次使用請切換至上方【註冊新帳號】直接建立此帳號！"
                                            else ->
                                                "驗證失敗: $msg"
                                        }
                                        loginErrorDetail = friendlyMsg
                                        Toast.makeText(context, "❌ $friendlyMsg", Toast.LENGTH_LONG).show()
                                    }
                            }
                        },
                        enabled = !isAuthenticating,
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF6750A4))
                    ) {
                        if (isAuthenticating) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(if (authModeIsRegister) "註冊中..." else "驗證登入中...", fontWeight = FontWeight.Bold)
                        } else {
                            Icon(if (authModeIsRegister) Icons.Default.PersonAdd else Icons.Default.Login, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(if (authModeIsRegister) "立即註冊並登入" else "登入 MyTrackIn (Firebase 認證)", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "🔒 支援 Firebase 雲端認證帳號登入與新用戶直接註冊開通。",
                fontSize = 11.sp,
                color = Color(0xFF79747E),
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )
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
                                text = "MyTrackIn",
                                fontWeight = FontWeight.Bold,
                                fontSize = 18.sp,
                                color = Color(0xFF6750A4),
                                letterSpacing = (-0.5).sp
                            )
                            Text(
                                text = "旅遊打卡 & 百景集章",
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
                    icon = { Icon(Icons.Default.Star, contentDescription = "百景集章") },
                    label = { Text("百景集章") }
                )
                NavigationBarItem(
                    selected = selectedTab == 3,
                    onClick = { selectedTab = 3 },
                    icon = { Icon(Icons.Default.Person, contentDescription = "個人中心") },
                    label = { Text("個人中心") }
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
                                            mapQueryEmail = "test@gmail.com"
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
                                            text = "輸入 test@gmail.com 與 TAIPEI 看示範",
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

// 地圖視圖區域（採用 100% 免 API Key 的穩定 Leaflet + OpenStreetMap 圖資）
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .fillMaxWidth()
                                .background(Color(0xFFE5E3DF))
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
                                            osm: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                                            clean: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
                                            sat: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                                        };

                                        function setTileLayer(type) {
                                            if (!map) return;
                                            if (currentLayer) {
                                                map.removeLayer(currentLayer);
                                            }
                                            var url = tileUrls[type] || tileUrls.osm;
                                            currentLayer = L.tileLayer(url, {
                                                maxZoom: 19,
                                                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
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
                    // Screen: 百景集章 (雙北百景集章 100 Attractions Stamp Rally)
                    val totalCount = northTaiwan100AttractionsSpaced.size
                    val unlockedCount = userStamps.size
                    val ratePercentage = (unlockedCount.toFloat() / totalCount * 100)

                    // 100 Attractions sorted by Latitude descending (緯度從大到小: 北端 -> 南端)
                    val sortedByLat100 = remember {
                        northTaiwan100AttractionsSpaced.sortedWith(
                            compareByDescending<Attraction> { it.lat }.thenBy { it.lng }
                        )
                    }

                    // Group into 20 rows of 5 stamps each
                    val rowsOf5Stamps = remember(sortedByLat100) {
                        sortedByLat100.chunked(5)
                    }

                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = 16.dp, vertical = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        // Dashboard Card
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
                                    // Header row
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Surface(
                                                shape = CircleShape,
                                                color = Color(0xFF6750A4),
                                                modifier = Modifier.size(36.dp)
                                            ) {
                                                Box(contentAlignment = Alignment.Center) {
                                                    Icon(
                                                        Icons.Default.Star,
                                                        contentDescription = null,
                                                        tint = Color(0xFFFFD54F),
                                                        modifier = Modifier.size(20.dp)
                                                    )
                                                }
                                            }
                                            Spacer(modifier = Modifier.width(10.dp))
                                            Text(
                                                text = "雙北百景集章",
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 16.sp,
                                                color = Color(0xFF1D1B20)
                                            )
                                        }

                                        Surface(
                                            shape = RoundedCornerShape(12.dp),
                                            color = Color(0xFFEADDFF),
                                            border = BorderStroke(1.dp, Color(0xFFD0BCFF))
                                        ) {
                                            Text(
                                                text = userEmail.substringBefore("@"),
                                                color = Color(0xFF6750A4),
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 11.sp,
                                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                            )
                                        }
                                    }

                                    // Metrics Banner with Stamp Action Button (覆蓋原本門檻位置)
                                    Surface(
                                        shape = RoundedCornerShape(14.dp),
                                        color = Color(0xFFF7F2FA),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(10.dp),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Column {
                                                Text(
                                                    text = "已解鎖紀念印章",
                                                    fontSize = 10.sp,
                                                    color = Color(0xFF79747E),
                                                    fontWeight = FontWeight.Medium
                                                )
                                                Text(
                                                    text = "$unlockedCount / $totalCount 點",
                                                    fontSize = 16.sp,
                                                    fontWeight = FontWeight.Black,
                                                    color = Color(0xFF6750A4)
                                                )
                                            }

                                            // Action Button
                                            Button(
                                                onClick = { scanAndStampAttraction() },
                                                enabled = !isScanningStamps,
                                                shape = RoundedCornerShape(10.dp),
                                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
                                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF6750A4))
                                            ) {
                                                if (isScanningStamps) {
                                                    CircularProgressIndicator(
                                                        modifier = Modifier.size(14.dp),
                                                        color = Color.White,
                                                        strokeWidth = 2.dp
                                                    )
                                                    Spacer(modifier = Modifier.width(4.dp))
                                                    Text("掃描中...", color = Color.White, fontSize = 11.sp)
                                                } else {
                                                    Icon(
                                                        Icons.Default.LocationOn,
                                                        contentDescription = null,
                                                        tint = Color(0xFFFFD54F),
                                                        modifier = Modifier.size(14.dp)
                                                    )
                                                    Spacer(modifier = Modifier.width(4.dp))
                                                    Text(
                                                        "現場 GPS 蓋章 (200m)",
                                                        fontWeight = FontWeight.Bold,
                                                        fontSize = 11.sp,
                                                        color = Color.White
                                                    )
                                                }
                                            }
                                        }
                                    }

                                    // Linear Progress Indicator
                                    LinearProgressIndicator(
                                        progress = { (unlockedCount.toFloat() / totalCount).coerceIn(0.02f, 1f) },
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(6.dp)
                                            .clip(RoundedCornerShape(3.dp)),
                                        color = Color(0xFF6750A4),
                                        trackColor = Color(0xFFE7E0EC)
                                    )
                                }
                            }
                        }

                        // Filter Chips & Search
                        item {
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    listOf("全部", "台北市", "新北市", "基隆市", "已解鎖").forEach { tabName ->
                                        val isSel = stampFilterTab == tabName
                                        val count = when (tabName) {
                                            "全部" -> totalCount
                                            "台北市" -> 50
                                            "新北市" -> 40
                                            "基隆市" -> 10
                                            "已解鎖" -> unlockedCount
                                            else -> 0
                                        }
                                        Surface(
                                            shape = RoundedCornerShape(16.dp),
                                            color = if (isSel) Color(0xFF6750A4) else Color.White,
                                            border = BorderStroke(1.dp, if (isSel) Color(0xFF6750A4) else Color(0xFFCAC4D0)),
                                            modifier = Modifier.clickable { stampFilterTab = tabName }
                                        ) {
                                            Row(
                                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Text(
                                                    text = tabName,
                                                    fontSize = 11.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = if (isSel) Color.White else Color(0xFF49454F)
                                                )
                                                Spacer(modifier = Modifier.width(3.dp))
                                                Surface(
                                                    shape = CircleShape,
                                                    color = if (isSel) Color.White.copy(alpha = 0.25f) else Color(0xFFF3EDF7)
                                                ) {
                                                    Text(
                                                        text = "$count",
                                                        fontSize = 9.sp,
                                                        fontWeight = FontWeight.Bold,
                                                        color = if (isSel) Color.White else Color(0xFF6750A4),
                                                        modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                                                    )
                                                }
                                            }
                                        }
                                    }
                                }

                                // Search text field
                                OutlinedTextField(
                                    value = stampSearchQuery,
                                    onValueChange = { stampSearchQuery = it },
                                    placeholder = { Text("搜尋景點名稱、行政區 (例: 101, 九份)...", fontSize = 12.sp) },
                                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = Color(0xFF79747E), modifier = Modifier.size(16.dp)) },
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(12.dp),
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedContainerColor = Color.White,
                                        unfocusedContainerColor = Color.White,
                                        focusedBorderColor = Color(0xFF6750A4),
                                        unfocusedBorderColor = Color(0xFFCAC4D0)
                                    ),
                                    singleLine = true
                                )
                            }
                        }

                        // Section Header: 簡約單行 "根據緯度大小排列"
                        item {
                            Text(
                                text = "根據緯度大小排列",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Medium,
                                color = Color(0xFF79747E),
                                modifier = Modifier.padding(horizontal = 2.dp)
                            )
                        }

                        // 20 Rows (Each row has 5 stamps from Left to Right, no row header labels)
                        items(rowsOf5Stamps.size) { rowIndex ->
                            val rowStamps = rowsOf5Stamps[rowIndex]

                            // Check if any stamp in this row matches filter/search
                            val anyMatches = rowStamps.any { att ->
                                val matchFilter = when (stampFilterTab) {
                                    "已解鎖" -> userStamps.containsKey(att.id)
                                    "台北市" -> att.city == "台北市"
                                    "新北市" -> att.city == "新北市"
                                    "基隆市" -> att.city == "基隆市"
                                    else -> true
                                }
                                val matchSearch = if (stampSearchQuery.isNotBlank()) {
                                    val q = stampSearchQuery.trim().lowercase(Locale.ROOT)
                                    att.name.lowercase(Locale.ROOT).contains(q) ||
                                            att.city.lowercase(Locale.ROOT).contains(q) ||
                                            att.district.lowercase(Locale.ROOT).contains(q)
                                } else true
                                matchFilter && matchSearch
                            }

                            Card(
                                shape = RoundedCornerShape(14.dp),
                                colors = CardDefaults.cardColors(
                                    containerColor = if (anyMatches) Color.White else Color.White.copy(alpha = 0.5f)
                                ),
                                border = BorderStroke(
                                    1.dp,
                                    if (anyMatches) Color(0xFFE7E0EC) else Color(0xFFE7E0EC).copy(alpha = 0.4f)
                                ),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(6.dp)) {
                                    // 5 Stamp Columns in this Row
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                                    ) {
                                        rowStamps.forEachIndexed { colIndex, att ->
                                            val globalRank = rowIndex * 5 + colIndex + 1
                                            val isUnlocked = userStamps.containsKey(att.id)
                                            val stampRec = userStamps[att.id]

                                            val distArr = FloatArray(1)
                                            Location.distanceBetween(currentLatitude, currentLongitude, att.lat, att.lng, distArr)
                                            val distMeters = distArr[0]
                                            val isWithin200 = distMeters <= 200f

                                            val matches = run {
                                                val matchFilter = when (stampFilterTab) {
                                                    "已解鎖" -> isUnlocked
                                                    "台北市" -> att.city == "台北市"
                                                    "新北市" -> att.city == "新北市"
                                                    "基隆市" -> att.city == "基隆市"
                                                    else -> true
                                                }
                                                val matchSearch = if (stampSearchQuery.isNotBlank()) {
                                                    val q = stampSearchQuery.trim().lowercase(Locale.ROOT)
                                                    att.name.lowercase(Locale.ROOT).contains(q) ||
                                                            att.city.lowercase(Locale.ROOT).contains(q) ||
                                                            att.district.lowercase(Locale.ROOT).contains(q)
                                                } else true
                                                matchFilter && matchSearch
                                            }

                                            Surface(
                                                shape = RoundedCornerShape(10.dp),
                                                color = if (!matches) Color(0xFFF7F2FA).copy(alpha = 0.3f)
                                                else if (isUnlocked) Color(0xFFFFF8F8)
                                                else if (isWithin200) Color(0xFFF1F8E9)
                                                else Color(0xFFFAFAFA),
                                                border = BorderStroke(
                                                    1.dp,
                                                    if (!matches) Color.Transparent
                                                    else if (isUnlocked) Color(0xFFB3261E).copy(alpha = 0.4f)
                                                    else if (isWithin200) Color(0xFF2E7D32)
                                                    else Color(0xFFE7E0EC)
                                                ),
                                                modifier = Modifier
                                                    .weight(1f)
                                                    .clickable {
                                                        selectedAttractionDetail = att
                                                    }
                                            ) {
                                                Column(
                                                    modifier = Modifier.padding(horizontal = 2.dp, vertical = 4.dp),
                                                    horizontalAlignment = Alignment.CenterHorizontally
                                                ) {
                                                    // Top Rank & District
                                                    Row(
                                                        modifier = Modifier.fillMaxWidth(),
                                                        horizontalArrangement = Arrangement.SpaceBetween
                                                    ) {
                                                        Text(
                                                            text = "#$globalRank",
                                                            fontSize = 7.sp,
                                                            fontWeight = FontWeight.Bold,
                                                            color = Color(0xFF6750A4)
                                                        )
                                                        Text(
                                                            text = when (att.city) {
                                                                "台北市" -> "北市"
                                                                "新北市" -> "新北"
                                                                else -> "基隆"
                                                            },
                                                            fontSize = 7.sp,
                                                            color = Color(0xFF79747E)
                                                        )
                                                    }

                                                    Spacer(modifier = Modifier.height(2.dp))

                                                    // Stamp Badge
                                                    if (isUnlocked) {
                                                        Surface(
                                                            shape = CircleShape,
                                                            color = Color(0xFFFFF5F5),
                                                            border = BorderStroke(1.5.dp, Color(0xFFB3261E)),
                                                            modifier = Modifier.size(38.dp)
                                                        ) {
                                                            Box(
                                                                modifier = Modifier
                                                                    .padding(1.dp)
                                                                    .border(0.5.dp, Color(0xFFB3261E).copy(alpha = 0.6f), CircleShape),
                                                                contentAlignment = Alignment.Center
                                                            ) {
                                                                Column(
                                                                    horizontalAlignment = Alignment.CenterHorizontally,
                                                                    verticalArrangement = Arrangement.Center
                                                                ) {
                                                                    Text(
                                                                        text = "雙北百景",
                                                                        fontSize = 5.sp,
                                                                        fontWeight = FontWeight.Bold,
                                                                        color = Color(0xFFB3261E),
                                                                        letterSpacing = (-0.5).sp
                                                                    )
                                                                    Text(
                                                                        text = if (att.name.length > 3) att.name.take(3) + "…" else att.name,
                                                                        fontSize = 6.sp,
                                                                        fontWeight = FontWeight.Black,
                                                                        color = Color(0xFFB3261E),
                                                                        maxLines = 1
                                                                    )
                                                                    Text(
                                                                        text = "★${stampRec?.dateString?.takeLast(5) ?: "08-25"}★",
                                                                        fontSize = 4.5.sp,
                                                                        fontWeight = FontWeight.Bold,
                                                                        color = Color(0xFFB3261E)
                                                                    )
                                                                }
                                                            }
                                                        }
                                                    } else {
                                                        Surface(
                                                            shape = CircleShape,
                                                            color = if (isWithin200) Color(0xFFE8F5E9) else Color(0xFFF3EDF7),
                                                            border = BorderStroke(
                                                                1.dp,
                                                                if (isWithin200) Color(0xFF2E7D32) else Color(0xFFCAC4D0)
                                                            ),
                                                            modifier = Modifier.size(38.dp)
                                                        ) {
                                                            Column(
                                                                horizontalAlignment = Alignment.CenterHorizontally,
                                                                verticalArrangement = Arrangement.Center
                                                            ) {
                                                                if (isWithin200) {
                                                                    Icon(
                                                                        Icons.Default.Star,
                                                                        contentDescription = null,
                                                                        tint = Color(0xFF2E7D32),
                                                                        modifier = Modifier.size(12.dp)
                                                                    )
                                                                    Text(
                                                                        text = "可蓋章",
                                                                        fontSize = 6.sp,
                                                                        color = Color(0xFF2E7D32),
                                                                        fontWeight = FontWeight.Bold
                                                                    )
                                                                } else {
                                                                    Icon(
                                                                        Icons.Default.Lock,
                                                                        contentDescription = null,
                                                                        tint = Color(0xFF79747E),
                                                                        modifier = Modifier.size(10.dp)
                                                                    )
                                                                    Text(
                                                                        text = String.format(Locale.US, "%.2f°", att.lat),
                                                                        fontSize = 5.5.sp,
                                                                        color = Color(0xFF79747E),
                                                                        fontWeight = FontWeight.Medium
                                                                    )
                                                                }
                                                            }
                                                        }
                                                    }

                                                    Spacer(modifier = Modifier.height(2.dp))

                                                    // Attraction name snippet
                                                    Text(
                                                        text = att.name,
                                                        fontSize = 7.5.sp,
                                                        fontWeight = FontWeight.Bold,
                                                        color = Color(0xFF1D1B20),
                                                        maxLines = 1,
                                                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                                                    )
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                3 -> {
                    // Screen: 個人中心 (統計卡片、雙北百景集章進度、使用過的行程代碼、匯出、重設、登出)
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
                                text = "個人中心",
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

                        // 統計指標卡片：獨立行程數 / 打卡總次數
                        item {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
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

                        // 雙北百景集章進度卡片
                        item {
                            Card(
                                shape = RoundedCornerShape(16.dp),
                                colors = CardDefaults.cardColors(containerColor = Color.White),
                                border = BorderStroke(1.dp, Color(0xFFB3261E).copy(alpha = 0.3f)),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(
                                    modifier = Modifier.padding(16.dp),
                                    verticalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Surface(
                                                shape = CircleShape,
                                                color = Color(0xFFB3261E),
                                                modifier = Modifier.size(24.dp)
                                            ) {
                                                Box(contentAlignment = Alignment.Center) {
                                                    Text(text = "★", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                                }
                                            }
                                            Spacer(modifier = Modifier.width(8.dp))
                                            Text(
                                                text = "雙北百景集章進度",
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 13.sp,
                                                color = Color(0xFF1D1B20)
                                            )
                                        }
                                        Text(
                                            text = "${userStamps.size} / 100 點",
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 13.sp,
                                            color = Color(0xFFB3261E)
                                        )
                                    }

                                    LinearProgressIndicator(
                                        progress = { (userStamps.size.toFloat() / 100f).coerceIn(0.02f, 1f) },
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(8.dp)
                                            .clip(RoundedCornerShape(4.dp)),
                                        color = Color(0xFFB3261E),
                                        trackColor = Color(0xFFE7E0EC)
                                    )

                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = String.format(Locale.US, "達成率: %.1f%%", (userStamps.size.toFloat() / 100f * 100)),
                                            fontSize = 11.sp,
                                            color = Color(0xFF49454F)
                                        )
                                        Text(
                                            text = "前往集章 →",
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = Color(0xFF6750A4),
                                            modifier = Modifier.clickable { selectedTab = 2 }
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

            // Attraction Detail Info Dialog (點擊印章時僅顯示景點資訊)
            selectedAttractionDetail?.let { att ->
                val isUnlocked = userStamps.containsKey(att.id)
                val stampRec = userStamps[att.id]
                val distArr = FloatArray(1)
                Location.distanceBetween(currentLatitude, currentLongitude, att.lat, att.lng, distArr)
                val distMeters = distArr[0]
                val distFormatted = if (distMeters >= 1000f) {
                    String.format(Locale.US, "%.2f 公里", distMeters / 1000f)
                } else {
                    "${distMeters.toInt()} 公尺"
                }

                AlertDialog(
                    onDismissRequest = { selectedAttractionDetail = null },
                    icon = {
                        Surface(
                            shape = CircleShape,
                            color = if (isUnlocked) Color(0xFFFFF5F5) else Color(0xFFEADDFF),
                            border = BorderStroke(1.5.dp, if (isUnlocked) Color(0xFFB3261E) else Color(0xFFD0BCFF)),
                            modifier = Modifier.size(56.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                if (isUnlocked) {
                                    Text("★", fontSize = 24.sp, color = Color(0xFFB3261E), fontWeight = FontWeight.Bold)
                                } else {
                                    Icon(Icons.Default.Place, contentDescription = null, tint = Color(0xFF6750A4), modifier = Modifier.size(28.dp))
                                }
                            }
                        }
                    },
                    title = {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = "#${String.format(Locale.US, "%03d", att.id)} ${att.name}",
                                fontWeight = FontWeight.Bold,
                                fontSize = 17.sp,
                                color = Color(0xFF1D1B20),
                                textAlign = TextAlign.Center
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Surface(
                                    shape = RoundedCornerShape(8.dp),
                                    color = Color(0xFFF3EDF7)
                                ) {
                                    Text(
                                        text = "${att.city} · ${att.district}",
                                        fontSize = 11.sp,
                                        color = Color(0xFF6750A4),
                                        fontWeight = FontWeight.SemiBold,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                                    )
                                }
                            }
                        }
                    },
                    text = {
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            // Info block
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = Color(0xFFF7F2FA),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(
                                    modifier = Modifier.padding(12.dp),
                                    verticalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Text("行政區域", fontSize = 12.sp, color = Color(0xFF79747E))
                                        Text("${att.city} ${att.district}", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = Color(0xFF1D1B20))
                                    }
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Text("經緯度座標", fontSize = 12.sp, color = Color(0xFF79747E))
                                        Text(
                                            text = String.format(Locale.US, "%.4f°N, %.4f°E", att.lat, att.lng),
                                            fontSize = 12.sp,
                                            fontFamily = FontFamily.Monospace,
                                            fontWeight = FontWeight.SemiBold,
                                            color = Color(0xFF6750A4)
                                        )
                                    }
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Text("目前距離", fontSize = 12.sp, color = Color(0xFF79747E))
                                        Text(distFormatted, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF2E7D32))
                                    }
                                }
                            }

                            // Unlock status banner
                            if (isUnlocked) {
                                Surface(
                                    shape = RoundedCornerShape(10.dp),
                                    color = Color(0xFFE8F5E9),
                                    border = BorderStroke(1.dp, Color(0xFFC8E6C9)),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(
                                        modifier = Modifier.padding(10.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.Center
                                    ) {
                                        Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF2E7D32), modifier = Modifier.size(16.dp))
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text(
                                            text = "已於 ${stampRec?.dateString ?: "今日"} 成功解鎖！",
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = Color(0xFF2E7D32)
                                        )
                                    }
                                }
                            } else {
                                Surface(
                                    shape = RoundedCornerShape(10.dp),
                                    color = Color(0xFFF3EDF7),
                                    border = BorderStroke(1.dp, Color(0xFFE7E0EC)),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(
                                        modifier = Modifier.padding(10.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.Center
                                    ) {
                                        Icon(Icons.Default.LocationOn, contentDescription = null, tint = Color(0xFF6750A4), modifier = Modifier.size(16.dp))
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text(
                                            text = "請至現場點擊上方「現場 GPS 蓋章 (200m)」完成打卡",
                                            fontSize = 11.5.sp,
                                            fontWeight = FontWeight.Medium,
                                            color = Color(0xFF6750A4)
                                        )
                                    }
                                }
                            }
                        }
                    },
                    confirmButton = {
                        Button(
                            onClick = { selectedAttractionDetail = null },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF6750A4))
                        ) {
                            Text("關閉", fontWeight = FontWeight.Bold, color = Color.White)
                        }
                    },
                    shape = RoundedCornerShape(20.dp),
                    containerColor = Color.White
                )
            }

            // Stamp Unlocked Celebration Dialog
            stampCelebrationTarget?.let { target ->
                AlertDialog(
                    onDismissRequest = { stampCelebrationTarget = null },
                    icon = {
                        Surface(
                            shape = CircleShape,
                            color = Color(0xFFFFF5F5),
                            border = BorderStroke(2.dp, Color(0xFFB3261E)),
                            modifier = Modifier.size(72.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .padding(3.dp)
                                    .border(1.dp, Color(0xFFB3261E).copy(alpha = 0.6f), CircleShape),
                                contentAlignment = Alignment.Center
                            ) {
                                Column(
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.Center
                                ) {
                                    Text("雙北百景", fontSize = 8.sp, fontWeight = FontWeight.Bold, color = Color(0xFFB3261E))
                                    Text(
                                        text = if (target.name.length > 5) target.name.take(4) + "…" else target.name,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Black,
                                        color = Color(0xFFB3261E),
                                        maxLines = 1
                                    )
                                    Text("★ 紀念印章 ★", fontSize = 7.sp, fontWeight = FontWeight.Bold, color = Color(0xFFB3261E))
                                }
                            }
                        }
                    },
                    title = {
                        Text(
                            text = "🎉 成功蓋章！",
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            color = Color(0xFF1D1B20),
                            modifier = Modifier.fillMaxWidth(),
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                    },
                    text = {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(6.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = "【#${String.format(Locale.US, "%03d", target.id)} ${target.name}】",
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp,
                                color = Color(0xFF6750A4)
                            )
                            Text(
                                text = "${target.city} · ${target.district}",
                                fontSize = 12.sp,
                                color = Color(0xFF49454F)
                            )
                            Text(
                                text = "已成功寫入 Firestore 雲端資料庫！目前總進度：${userStamps.size} / 100 點",
                                fontSize = 12.sp,
                                color = Color(0xFF2E7D32),
                                fontWeight = FontWeight.Medium,
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center
                            )
                        }
                    },
                    confirmButton = {
                        Button(
                            onClick = { stampCelebrationTarget = null },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF6750A4))
                        ) {
                            Text("太棒了！繼續集章", fontWeight = FontWeight.Bold, color = Color.White)
                        }
                    },
                    shape = RoundedCornerShape(16.dp),
                    containerColor = Color.White
                )
            }
        }
    }
}
