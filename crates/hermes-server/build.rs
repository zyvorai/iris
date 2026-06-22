use std::process::Command;

fn main() {
    let output = Command::new("sh")
        .args(["-c", "date +%Y-%m-%d"])
        .output()
        .expect("Failed to get build date");
    let date = String::from_utf8(output.stdout)
        .expect("date output is not UTF-8")
        .trim()
        .to_string();
    println!("cargo:rustc-env=HERMES_BUILD_DATE={date}");
    println!("cargo:rerun-if-changed=build.rs");
}
